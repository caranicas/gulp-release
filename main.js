module.exports = function (gulp) {

    var argv = require('yargs').argv;
    var bump = require('gulp-bump');
    var fs = require('fs');
    var git = require('gulp-git');
    var jeditor = require("gulp-json-editor");
    var spawn = require('child_process').spawn;
    var semver = require('semver');
    var tag_version = require('./tag_version');
    var through = require('through2');
    var _ = require('lodash');

    var branch = argv.branch || 'master';
    var rootDir = require('path').resolve(argv.rootDir || './') + '/';

    var printError = function (err) {
        if (err) {
            console.error(err);
        }
    };

    var currVersion = function () {
        return JSON.parse(fs.readFileSync(rootDir + 'package.json')).version;
    };

    var commitIt = function (file, enc, cb) {
        if (file.isNull()) return cb(null, file);
        if (file.isStream()) return cb(new Error('Streaming not supported'));

        var commitMessage = "Bumps version to v" + JSON.parse(fs.readFileSync(file.path)).version;
        gulp.src('./*.json', {cwd: rootDir}).pipe(git.commit(commitMessage, {cwd: rootDir})).on('end', function () {
            git.push('origin', branch, {cwd: rootDir}, printError);
        });
    };

    var paths = {
        versionsToBump: _.map(['package.json', 'bower.json', 'manifest.json'], function (fileName) {
            return rootDir + fileName;
        })
    };

    gulp.task('complete-release', gulp.series(
        'tag-and-push',
        'npm-publish',
        'bump'
    ));

    gulp.task('bump-complete-release', gulp.series(
        'bump', 
        'tag-and-push',
        'npm-publish'
    ));

    gulp.task('release', gulp.series(
        'tag-and-push',
        'bump'
    ));

    gulp.task('bump-release', gulp.series(
       'bump',
       'tag-and-push'
    ));

    gulp.task('tag-and-push', function (done) {
        gulp.src('./', {cwd: rootDir})
            .pipe(tag_version({version: currVersion(), cwd: rootDir}))
            .on('end', function () {
                git.push('origin', branch, {args: '--tags', cwd: rootDir}, done);
            });
    });

    var versioning = function () {
        if (preid()) {
            return 'prerelease';
        }
        if (argv.minor) {
            return 'minor';
        }
        if (argv.major) {
            return 'major';
        }
        return 'patch';
    };

    var preid = function () {
        if (argv.alpha) {
            return 'alpha';
        }
        if (argv.beta) {
            return 'beta';
        }
        if (argv.RC) {
            return 'RC';
        }
        if (argv['pre-release']) {
            return argv['pre-release'];
        }
        return undefined;
    };

    gulp.task('bump', function (resolve) {
        var newVersion = semver.inc(currVersion(), versioning(), preid());
        gulp.src(paths.versionsToBump, {cwd: rootDir})
            .pipe(jeditor({
                'version': newVersion
            }))
            .pipe(gulp.dest('./', {cwd: rootDir}))
            .pipe(through.obj(commitIt))
            .pipe(git.push('origin', branch, {cwd: rootDir}, resolve));
    });

    gulp.task('npm-publish', function (done) {
        spawn('npm', ['publish', rootDir], {stdio: 'inherit'}).on('close', done);
    });

};