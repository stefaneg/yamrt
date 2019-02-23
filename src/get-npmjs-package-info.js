var npmPackage = require('npm-package-info');

const getNpmjsPackageInfo = (dirInfo) => {
    return new Promise((resolve, reject) => {
        npmPackage(dirInfo.packageJson.name, (err, pkg) => {
            if(err.status === 404){
                return resolve({
                    err: err,
                    status: err.status,
                    versions:[]
                })
            } else {
                reject(err)
            }

            dirInfo.npmJsPackage = pkg;
            resolve(dirInfo);

            // t.error(err, 'should not error')
            // t.equal(typeof pkg, 'object', 'should return an object')
            // t.equal(pkg.name, 'npm-package-info', 'name should be correct')
            // t.ok(pkg.versions, 'should have a versions key')
            // t.notOk(pkg.readme, 'should omit the readme key')
        });

    });
};

module.exports = getNpmjsPackageInfo;