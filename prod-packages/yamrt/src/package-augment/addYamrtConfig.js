const fs = require('fs');
const path = require('path');

module.exports = function (projectInfo) {
    return new Promise((resolve, reject) => {
        let yamrtConfigFilePath = path.join(projectInfo.path, 'yamrt.json');
        if(fs.existsSync(yamrtConfigFilePath)){

            console.debug('Loading yamrtconf', yamrtConfigFilePath)
            fs.readFile(yamrtConfigFilePath, 'utf8', (err, data) => {
                if (err) return reject(err);
                try{
                    projectInfo.yamrtConfig = JSON.parse(data);
                }catch(err){
                    projectInfo.loadExceptions.push({
                        errorType: 'yamrt-json-load',
                        error: err
                    })
                }
                resolve(projectInfo);
            });

        } else{
            resolve(projectInfo);
        }
    });
};
