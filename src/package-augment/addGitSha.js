const shellExec = require('shell-exec')

module.exports=function (packageDirInfo) {
    return shellExec(`cd  ${packageDirInfo.path} && git ls-files -s . | git hash-object --stdin`).then((execResult)=>{
        packageDirInfo.dirGitSha = execResult.stdout.trim();
        console.debug(packageDirInfo.path, 'dirGitSha', packageDirInfo.dirGitSha)
        return packageDirInfo
    }).catch((err)=>{
        packageDirInfo.loadExceptions.push({
            errorType:'git-sha-load',
            error: err
        })

    })
};