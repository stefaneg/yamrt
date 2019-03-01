const fs = require('fs');
const path = require('path');

module.exports = function (projectInfo) {
    return new Promise((resolve, reject) => {
        let packageJsonPath = path.join(projectInfo.path, 'package.json');
        fs.readFile(packageJsonPath, 'utf8', (err, data) => {
            if (err) return reject(err);
            try{
                projectInfo.packageJson = JSON.parse(data);
            }catch(err){
                projectInfo.loadErrors.push({
                    errorType: 'package-json-load',
                    error: err
                })
            }
            resolve(projectInfo);
        });
    });
};
