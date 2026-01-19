"use strict";
const gulp = require('gulp');
const uglify = require('gulp-terser');
const notify = require('gulp-notify');
const concat = require('gulp-concat');
const rename = require('gulp-rename');
const jsdoc=require("gulp-jsdoc3");
const sourcemaps = require('gulp-sourcemaps');

const jsFiles = [
  "../../vendor/pixi.min.js","../../vendor/mcfud.min.js",
 "../../vendor/crafty.min.js",
  "../../vendor/shimoji.min.js",
  "ai.js","checkers.js"
];

var destDir = 'dist'; //or any folder inside your public asset folder
//To concat and Uglify All JS files in a particular folder
gulp.task("bundleJS", function(){
    return gulp.src(jsFiles)
        .pipe(concat("game.js")) //this will concat all the files into concat.js
        .pipe(gulp.dest("dist")) //this will save concat.js in a temp directory defined above
        .pipe(uglify()) //this will uglify/minify uglify.js
        .pipe(rename("game.min.js")) //this will rename concat.js to uglify.js
        .pipe(gulp.dest("dist")); //this will save uglify.js into destination Directory defined above
});

gulp.task("default", gulp.series("bundleJS"), function(){
  console.log("Gulp started");
});


