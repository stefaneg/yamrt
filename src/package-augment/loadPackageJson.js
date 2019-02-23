const fs = require('fs');
const path = require('path');

module.exports = function (projectInfo) {
    return new Promise((resolve, reject) => {
        fs.readFile(path.join(projectInfo.path, 'package.json'), 'utf8', (err, data) => {
            if (err) return reject(err);
            projectInfo.packageJson = JSON.parse(data);
            resolve(projectInfo);
        });
    });
};
