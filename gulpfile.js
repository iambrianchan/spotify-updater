

const eslint = require('gulp-eslint');
const gulp = require('gulp');
const plumber = require('gulp-plumber');

// Lint scripts
function scriptsLint() {
  return gulp
    .src(['./app/*.js', './app/**/*.js', './gulpfile.js'])
    .pipe(plumber())
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
}
const lint = gulp.series(scriptsLint);

// export tasks
exports.lint = lint;
exports.default = lint;
