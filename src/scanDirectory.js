const path = require('path');
const fs = require('fs');
const _ = require('lodash');

const Promise = require('bluebird');

module.exports = function recursiveScanDirectory (fullPath, startingDirectory = fullPath) {

    function initDir (dirPath) {
        let projectInfo = {
            path: dirPath,
            containsPackageJson: false,
            relativePath: path.relative(startingDirectory, dirPath),
            hasFile: (fileName) => {
                return projectInfo.fileList && projectInfo.fileList.indexOf(fileName) >= 0;
            },
            addSubDirFileEndings: (subDirCounts) => {
                _.each(subDirCounts, (count, ending) => {
                    projectInfo.addFileEnding(ending, count);
                });
            },
            addFileEnding: (fileEnding, count = 1) => {
                if (!fileEnding.length) {
                    return; // ignore directories and file without extensions
                }
                projectInfo.fileEndingCounts[fileEnding] = projectInfo.fileEndingCounts[fileEnding] || 0;
                projectInfo.fileEndingCounts[fileEnding] += count;
            },
            fileEndingCounts: {}
        };
        return projectInfo;
    }

    return new Promise(function (resolve, reject) {

        let baseName = path.basename(fullPath);
        const ignoreDirectory = {
            'node_modules': true,
            'bower_components': true,
            'dist': true,
            'build': true
        };

        if (baseName.startsWith('.') || ignoreDirectory[baseName]) {
            return resolve([]);
        }

        fs.stat(fullPath, function (err, stat) {

            if (stat && stat.isDirectory()) {

                let projectInfo;

                let projectsInDir = [];

                if (!fullPath.path) {
                    projectInfo = initDir(fullPath);
                } else {
                    throw new Error('DIR ALREADY INITIALIZED!!!!');
                }

                let packageJsonFileName = path.join(fullPath, 'package.json');
                if (fs.existsSync(packageJsonFileName)) {
                    projectInfo.containsPackageJson = true;
                }
                projectsInDir.push(projectInfo);

                fs.readdir(projectInfo.path, function (err, fileList) {
                    if (err) reject(err);
                    if (!fileList) {
                        // console.error(err, fileList);
                        throw new Error('No list!!');
                    }

                    projectInfo.fileList = fileList;

                    _.each(fileList, (fileName) => {
                        projectInfo.addFileEnding(path.extname(fileName));
                    });

                    let allScanningPromises = fileList.map((fileName) => path.join(fullPath, fileName)).map((path) => recursiveScanDirectory(path, startingDirectory));

                    if (allScanningPromises.length) {
                        Promise.all(allScanningPromises).then((allSubDirProjectLists) => {

                            allSubDirProjectLists.forEach((subProjectList) => {
                                if (subProjectList.length) {
                                    subProjectList.forEach((projectInDir) => {
                                        projectInfo.addSubDirFileEndings(projectInDir.fileEndingCounts);

                                        if (projectInDir && projectInDir.path) {
                                            projectsInDir.push(projectInDir);
                                        } else {
                                            console.log('INVALID SUBPROJECT OBJECT ', projectInDir);
                                            throw new Error('INVALID....');
                                        }

                                    });
                                }
                            });
                            resolve(projectsInDir);
                        });
                    } else {
                        // console.log(('No scan promises in ', projectInfo.path))
                        resolve(projectsInDir);
                    }
                });

            } else {
                resolve([]);
            }
        });
    });
};