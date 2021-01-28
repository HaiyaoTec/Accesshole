function authRuleMatch(authRule, url) {
    return calInclude(authRule.includes, url) && calExclude(authRule.excludes, url)
}

function calInclude(includes, url) {
    if (includes) {
        for (let include of includes) {
            return new RegExp(include).test(url);
        }
        return false
    }
    return true
}

function calExclude(excludes, url) {
    if (excludes) {
        for (let exclude of excludes) {
            return !new RegExp(exclude).test(url);
        }
        return false
    }
    return true
}

exports.default = authRuleMatch
