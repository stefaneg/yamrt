const shellExec = require('shell-exec')

module.exports=function (packageDirInfo) {
    return shellExec(`git ls-files -s ${packageDirInfo.path} | git hash-object --stdin`).then((execResult)=>{
        packageDirInfo.dirGitSha = execResult.stdout.trim();
        return packageDirInfo
    }).catch((err)=>{
        packageDirInfo.loadExceptions.push({
            errorType:'git-sha-load',
            error: err
        })

    })
};