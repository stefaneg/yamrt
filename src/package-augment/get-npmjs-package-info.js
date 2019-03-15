var npmPackage = require('../registry-package-info/registry-package-info');

const getNpmjsPackageInfo = (dirInfo) => {
    return new Promise((resolve, reject) => {
        if (dirInfo.packageJsonParsingError) {
            resolve(dirInfo);
        } else {
            try {
                npmPackage(dirInfo.packageJson.name, (err, pkg) => {
                    if (err) {
                        dirInfo.loadErrors.push({
                            errorType: 'npm-js-package-info',
                            err: err,
                            status: err.status,
                        });
                    } else {
                        dirInfo.npmJsPackage = pkg;
                    }

                    resolve(dirInfo);

                    // t.error(err, 'should not error')
                    // t.equal(typeof pkg, 'object', 'should return an object')
                    // t.equal(pkg.name, 'npm-package-info', 'name should be correct')
                    // t.ok(pkg.versions, 'should have a versions key')
                    // t.notOk(pkg.readme, 'should omit the readme key')
                });

            } catch (err) {
                dirInfo.loadErrors.push({
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