var npmPackage = require('../registry-package-info/registry-package-info');

const getNpmjsPackageInfo = (dirInfo) => {
    return new Promise((resolve, reject) => {
        if (dirInfo.packageJsonParsingError) {
            resolve(dirInfo);
        } else {
            try {
                npmPackage(dirInfo.packageJson.name, (err, pkg) => {
                    if (err) {
                        if(err.status !== 404){
                            dirInfo.loadExceptions.push({
                                errorType: 'npm-js-package-info',
                                err: err,
                                status: err.status,
                            });
                        } // else we are ignoring 404, simply means that the package has never been published.
                    } else {
                        dirInfo.npmJsPackage = pkg;
                    }

                    console.debug(dirInfo.path, 'npmjs registry package info', pkg)
                    resolve(dirInfo);

                    // t.error(err, 'should not error')
                    // t.equal(typeof pkg, 'object', 'should return an object')
                    // t.equal(pkg.name, 'npm-package-info', 'name should be correct')
                    // t.ok(pkg.versions, 'should have a versions key')
                    // t.notOk(pkg.readme, 'should omit the readme key')
                });

            } catch (err) {
                dirInfo.loadExceptions.push({
                    errorType: 'npm-js-package-info',
                    err: err,
                    status: err.status,
                });
                resolve(dirInfo);
            }
        }
    });
};

module.exports = getNpmjsPackageInfo;