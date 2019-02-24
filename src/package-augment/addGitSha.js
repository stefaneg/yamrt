const shellExec = require('shell-exec')

module.exports=function (packageDirInfo) {
    return shellExec(`git log -n 1 --format="%h" -- ${packageDirInfo.path}`).then(console.log).catch(console.log)


}