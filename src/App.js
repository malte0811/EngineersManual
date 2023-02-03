import './styling/manual.scss';
import React from "react";
import {Link, Navigate, Route, Routes, useSearchParams} from 'react-router-dom'
import {ManualEntry} from "./manual_entry";
import {
    addTranslation,
    addTranslationMultiple, DEFAULT_LANGUAGE,
    prefixManual, SUPPORTED_LANGUAGES,
    translate,
} from "./localization";
import {
    DEFAULT_REPO,
    EXCLUDED_VERSION_BRANCHES,
    getAssetPath, getEntryJSON, getEntryText, getGeneratedAssetPath,
    getManualPath, repos
} from "./resources";
import {useNavigate, useParams} from "react-router";
import {SelectDropdown} from "./generic_elements";

const CATEGORIES = {};
const ENTRIES = {};

function clearManual() {
    for (let key in CATEGORIES)
        delete CATEGORIES[key];
    for (let key in ENTRIES)
        delete ENTRIES[key];
}

function loadCategory(repo, branch, lang, key, category, entryPromises, toplevel) {
    // check that it's a valid category
    if (typeof category === 'object' && 'entry_list' in category) {
        CATEGORIES[key] = {
            toplevel: toplevel,
            entries: category['entry_list'],
            subcategories: []
        };
        // delete parameters that have been handled
        delete category['category_weight'];
        delete category['entry_list'];
        // do deferred loading of the entries
        CATEGORIES[key].entries.forEach(key => entryPromises.push(loadEntry(repo, branch, lang, key)));
        // any remaining keys are assumed to be subcategories
        for (let subKey in category) {
            CATEGORIES[key].subcategories.push(subKey);
            loadCategory(repo, branch, lang, subKey, category[subKey], entryPromises, false);
        }
        return CATEGORIES[key];
    }
    return null;
}

function loadEntry(repo, branch, lang, key) {
    let url_data = getEntryJSON(branch, repo, key);
    let url_text = getEntryText(branch, repo, key, lang);
    let url_text_backup = getEntryText(branch, repo, key, DEFAULT_LANGUAGE);
    return Promise.all([
        fetch(url_data).then(res => res.json()),
        fetch(url_text).then(res => res.status === 200 ? res.text() : fetch(url_text_backup).then(res => res.text())),
    ]).then(values => {
        let raw_text = values[1].split('\n');
        let titles = raw_text.splice(0, 2);
        ENTRIES[key] =
            <ManualEntry
                key={key}
                branch={branch}
                lang={lang}
                data={values[0]}
                title={titles[0]}
                subtitle={titles[1]}
                text={raw_text.join('\n')}
            />;
        addTranslation(prefixManual(key), titles[0]);
    });
}

export function verifyEntryExists(branch, lang, key) {
    if (!(key in ENTRIES))
        return loadEntry(branch, lang, key);
    return new Promise(resolve => resolve());
}

const LATEST_BRANCH = 'latest';
const STABLE_BRANCH = 'stable';

let supportedBranches;
let stableBranch;

async function fetchSupportedBranches() {
    // TODO intersection of supported branches over all selected repos?
    const baseURL = `https://api.github.com/repos/${DEFAULT_REPO.owner}/${DEFAULT_REPO.name}`;
    const repoResponse = fetch(baseURL);
    const branchesResponse = fetch(baseURL+'/branches');
    const branchesJSON = await (await branchesResponse).json();
    supportedBranches = branchesJSON
        .map(b => b.name)
        .filter(name => name.startsWith('1.') && !EXCLUDED_VERSION_BRANCHES.has(name))
        .sort()
        .reverse();
    const repoJSON = await (await repoResponse).json();
    stableBranch = repoJSON['default_branch']
    if (!supportedBranches.includes(stableBranch)) {
        stableBranch = supportedBranches[0];
    }
}

function App() {
    return (
        <div className="manual">
            <Routes>
                <Route path={':lang/*'}>
                    <Route path={':branch/*'} element={<ManualWrapper/>}/>
                </Route>
                <Route path="*" element={<Navigate to={`${DEFAULT_LANGUAGE}/${STABLE_BRANCH}`}/>}/>
            </Routes>
        </div>
    );
}

function LanguageChoice(props) {
    const currentBranch = props.branch;
    const currentLang = props.lang;
    let navigate = useNavigate();
    if (useParams()['*'])
        return null;
    return <header>
        <SelectDropdown label="Version: " defaultValue={currentBranch} options={supportedBranches}
                        onChange={(val) => {
                            navigate(`/${currentLang}/${val}`);
                            window.location.reload(false);
                        }}/>
        <br/>
        <SelectDropdown label="Language: " defaultValue={currentLang} options={SUPPORTED_LANGUAGES}
                        onChange={(val) => {
                            navigate(`/${val}/${currentBranch}`);
                            window.location.reload(false);
                        }}/>
    </header>
}

// This is a stupid workaround necessitated by react-router v6,
// because useParams can only be used in function components, not class components
function ManualWrapper() {
    // TODO somehow include addon repos
    return <Manual
        branch={useParams()['branch']}
        lang={useParams()['lang']}
    />;
}

class Manual extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            initialized: false,
        };
    }

    render() {
        return (<>
            <BackButton/>
            <div className="content">
                <ManualContent initialized={this.state.initialized}/>
            </div>
            {this.state.initialized && <LanguageChoice branch={this.state.realBranch} lang={this.props.lang}/>}
        </>);
    }

    componentDidMount() {
        let branch = this.props.branch;
        let lang = this.props.lang;

        const getFiles = async () => {
            // clean up
            clearManual();
            await fetchSupportedBranches();
            if (branch === LATEST_BRANCH) {
                branch = supportedBranches[0];
            } else if (branch === STABLE_BRANCH) {
                branch = stableBranch;
            }
            const repoPromises = [];
            for (const repo of repos) {
                repoPromises.push(this.fetchRepo(repo, lang, branch));
            }
            await Promise.all(repoPromises);
            // finally update component
            this.setState({
                initialized: true,
                realBranch: branch,
            });
        };
        getFiles();
    }

    async fetchRepo(repo, lang, branch) {
        // TODO handle case where some repos don't not have the branch
        // get english default translation file
        await this.addTranslation(repo, DEFAULT_LANGUAGE, branch);
        if (lang !== DEFAULT_LANGUAGE) {
            // get specific translation file if different
            await this.addTranslation(repo, lang, branch);
        }
        // then get the manual index
        let entryPromises = []
        await fetch(`${getManualPath(branch, repo)}autoload.json`)
            .then(res => res.json())
            .then(data => {
                for (let key in data)
                    loadCategory(repo, branch, lang, key, data[key], entryPromises, true);
            });
        // then await all pages loading
        await Promise.all(entryPromises);
    }

    async addTranslation(repo, lang, branch) {
        const suffix = `lang/${lang}.json`;
        let response = await fetch(getAssetPath(branch, repo) + suffix);
        if (!response.ok) {
            response = await fetch(getGeneratedAssetPath(branch, repo) + suffix);
        }
        let langJSON = await response.json();
        addTranslationMultiple(langJSON);
    }
}
function BackButton() {
    return useParams()['*'] && <button id="back_button" onClick={() => window.history.back()}/>;
}

function ManualContent(props) {
    let params = useParams();
    let subpage = params['*'];
    if (!props.initialized)
        return (
            <div id="please_wait">
                <div className="clippy">
                    <div className="hand"/>
                </div>
                <p>Please wait, the Engineer's Manual is being loaded...</p>
            </div>
        );

    if (subpage === '') //show all categories
        return <EntryList title="manual" categories={Object.keys(CATEGORIES).filter(s => CATEGORIES[s].toplevel)}
                          entries={[]}/>;
    else if (subpage in CATEGORIES) // show subcategory
        return <EntryList title={subpage} categories={CATEGORIES[subpage].subcategories}
                          entries={CATEGORIES[subpage].entries}/>;
    else if (subpage in ENTRIES)
        return ENTRIES[subpage];
    return <Navigate to='/'/>;
}

function EntryList(props) {
    return <>
        <h2>{translate(prefixManual(props.title))}</h2>
        <ul className="entry-list">
            {props.categories.map(key =>
                <li key={key} className='category'>
                    <Link to={key}>
                        {translate(prefixManual(key))}
                    </Link>
                </li>
            )}
            {props.entries.map(key =>
                <li key={key} className='entry'>
                    <Link to={key}>
                        {translate(prefixManual(key))}
                    </Link>
                </li>
            )}
        </ul>
    </>;
}

export default App;
