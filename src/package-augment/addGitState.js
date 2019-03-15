var git = require('git-state');

module.exports = function (packageDirInfo) {

    return new Promise((resolve, reject) => {
        if (!packageDirInfo.path) {
            reject(new Error('No path in packageDirInfo!!! ' + JSON.stringify(packageDirInfo)));
        }
        git.isGit(packageDirInfo.path, function (exists) {
            packageDirInfo.isGitRepoDir = exists;
            git.check(packageDirInfo.path, function (err, result) {
                if (err) reject(err);
                result.modified = result.ahead > 0 || result.dirty > 0 || result.untracked > 0;
                packageDirInfo.gitStatus = result;
                resolve(packageDirInfo);
            });

            // }

        });

    });
};