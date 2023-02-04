export const EXCLUDED_VERSION_BRANCHES = new Set([
    '1.7.10', '1.8.9', '1.9.4', '1.10.2', '1.11.2', '1.13pre', '1.13'
]);

export const MOD_ID = 'immersiveengineering';
export const BASE_PATH = 'EngineersManual';

export const DEFAULT_REPO = {
    owner: 'BluSunrize', name: 'ImmersiveEngineering', modid: MOD_ID, branchMap: {}
};

export const repos = [];

function realBranch(repo, branch) {
    return repo.branchMap[branch] || branch;
}

export function getRepoBase(repo) {
    return `https://raw.githubusercontent.com/${repo.owner}/${repo.name}`;
}

export function getAssetPath(branch, repo) {
    return `${getRepoBase(repo)}/${realBranch(repo, branch)}/src/main/resources/assets/${repo.modid}/`;
}

export function getGeneratedAssetPath(branch, repo) {
    return `${getRepoBase(repo)}/${realBranch(repo, branch)}/src/generated/resources/assets/${repo.modid}/`;
}

export function getManualPath(branch, repo) {
    return `${getRepoBase(repo)}/${realBranch(repo, branch)}/src/main/resources/assets/immersiveengineering/manual/`;
}

export function getEntryJSON(branch, repo, entryName) {
    const decomposed = decomposeResourceLocation(entryName);
    return `${getRepoBase(repo)}/${realBranch(repo, branch)}/src/main/resources/assets/${decomposed.domain}/manual/${decomposed.name}.json`;
}

export function getEntryText(branch, repo, entryName, lang) {
    const decomposed = decomposeResourceLocation(entryName);
    return `${getRepoBase(repo)}/${realBranch(repo, branch)}/src/main/resources/assets/${decomposed.domain}/manual/${lang}/${decomposed.name}.txt`;
}

export function getRecipePath(branch, repo, recipeName) {
    const decomposed = decomposeResourceLocation(recipeName);
    return `${getRepoBase(repo)}/${realBranch(repo, branch)}/src/generated/resources/data/${decomposed.domain}/recipes/${decomposed.name}.json`;
}

export function getDataExportPath(branch, repo) {
    return `${getRepoBase(repo)}/manual-data/${realBranch(repo, branch)}/`;
}

export function getIconPath(branch, repo) {
    return getDataExportPath(branch, repo)+'icons';
}

export function getTagPath(branch, repo) {
    return getDataExportPath(branch, repo)+'tags';
}

/** This is super hacky and probably a bad idea, but it's holding so far! */
export function reactSetStateWrapper(element, state, mountKeyword = 'loaded') {
    // If element is mounted, use setState
    if (element.state[mountKeyword])
        element.setState(state);
    // Otherwise do direct assignment
    else
        for (let key in state)
            element.state[key] = state[key];
}

export function elementHasClass(element, css_class){
    if(!element)
        return false;
    if(!element.classList)
        return false;
    return element.classList.contains(css_class);
}

export function decomposeResourceLocation(fullName) {
    if (!fullName) {
        return {domain: undefined, name: undefined};
    }
    let split = fullName.split(':');
    let domain = split.length > 1 ? split[0] : MOD_ID;
    let name = split[split.length - 1];
    return {domain: domain, name: name};
}

