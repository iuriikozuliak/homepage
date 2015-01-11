/* jshint node:true */
'use strict';

var gulp = require('gulp');

var $ = require('gulp-load-plugins')();

var gulpsmith =     require('gulpsmith'),
    templates =     require('metalsmith-templates'),
    collections =   require('metalsmith-collections'),
    permalinks =    require('metalsmith-permalinks'),
    markdown =      require('metalsmith-markdown');

var handlebars =    require('handlebars'),
    rename =        require('gulp-rename'),
    webpack =       require('webpack'),
    path =          require('path'),
    frontMatter =   require('gulp-front-matter'),
    assign =        require('lodash').assign;


var projectPath = path.resolve(__dirname);

handlebars.registerHelper("debug", function(optionalValue) {
  if (optionalValue) {
    console.log("Value");
    console.log("====================");
    console.log(optionalValue);
  }
});

handlebars.registerHelper("lowercase", function(val) {
  if (val) {
   return val.toLowerCase();
  }
});

handlebars.registerHelper("is", function (value, test, options) {
  if (value === test) {
    return options.fn(this);
  } else {
    return options.inverse(this);
  }
});

gulp.task("webpack", function() {

  webpack({
    entry: {
      // The entry points for the pages
      about: "./app/scripts/pages/about",
      labs:  "./app/scripts/pages/labs",

      // This file contains common modules but also the router entry
      "commons.js":"./app/scripts/main"
    },
    output: {
      path: '.tmp/js/',
      publicPath: 'js/',
      filename: "[name].bundle.js",
      chunkFilename: "[id].chunk.js"
    },
    plugins: [
      // Extract common modules from the entries to the commons.js file
      // This is optional, but good for performance.
      new webpack.optimize.CommonsChunkPlugin("commons.js")
      // The pages cannot run without the commons.js file now.
    ]
  }, function(err, stats) {
    if(err) throw new gutil.PluginError("webpack", err);
   console.log(stats.toString())
  })

});

gulp.task('metalsmith', function() {

  gulp.src([
    'app/src/content/**/*',
  ])

    .pipe( frontMatter() ).on('data', function(file) {
      assign(file, file.frontMatter);
      delete file.frontMatter;
    })

    .pipe(gulpsmith()
      .use(collections({
        pages: {
          sortBy: 'date',
          reverse: true
        }
      }))
      .use(permalinks())
      .use( templates({
        engine:     'handlebars',
        directory:  'app/src/templates'
      }))
    )
    .pipe(rename(function (path) {
      path.extname = ".html"
    }))

    .pipe( gulp.dest( '.tmp' ) );
});

gulp.task('styles', function () {
  return gulp.src('app/styles/main.scss')
    .pipe($.plumber())
    .pipe($.rubySass({
      style: 'expanded',
      precision: 10
    }))
    .pipe($.autoprefixer({browsers: ['last 1 version']}))
    .pipe(gulp.dest('.tmp/styles'));
});

gulp.task('jshint', function () {
  return gulp.src('app/scripts/**/*.js')
    .pipe($.jshint())
    .pipe($.jshint.reporter('jshint-stylish'))
    .pipe($.jshint.reporter('fail'));
});

gulp.task('html', ['webpack', 'metalsmith', 'styles'], function () {
  var lazypipe = require('lazypipe');
  var cssChannel = lazypipe()
    .pipe($.csso);

  var assets = $.useref.assets({searchPath: '{.tmp,app}'});

  return gulp.src('.tmp/**/*.html')
    .pipe(assets)
    .pipe($.if('*.js', $.uglify()))
    .pipe($.if('*.css', cssChannel()))
    .pipe(assets.restore())
    .pipe($.useref())
    .pipe($.if('*.html', $.minifyHtml({conditionals: true, loose: true})))
    .pipe(gulp.dest('dist'));
});

gulp.task('images', function () {
  return gulp.src('app/assets/images/**/*')
    .pipe($.cache($.imagemin({
      progressive: true,
      interlaced: true
    })))
    .pipe(gulp.dest('dist/assets/images'));
});

gulp.task('fonts', function () {
  return gulp.src(require('main-bower-files')().concat('app/fonts/**/*'))
    .pipe($.filter('**/*.{eot,svg,ttf,woff}'))
    .pipe($.flatten())
    .pipe(gulp.dest('dist/fonts'));
});

gulp.task('extras', function () {
  return gulp.src([
    'app/*.*',
    '!app/*.html',
    'app/.htaccess'
  ], {
    dot: true
  }).pipe(gulp.dest('dist'));
});

gulp.task('clean', require('del').bind(null, ['.tmp', 'dist']));

gulp.task('connect', ['styles', 'webpack', 'metalsmith'], function () {
  var serveStatic = require('serve-static');
  var serveIndex = require('serve-index');
  var app = require('connect')()
    .use(require('connect-livereload')({port: 35729}))
    .use(serveStatic('.tmp'))
    .use(serveStatic('app'))
    // paths to bower_components should be relative to the current file
    // e.g. in app/index.html you should use ../bower_components
    .use('/bower_components', serveStatic('bower_components'))
    .use(serveIndex('app'));

  require('http').createServer(app)
    .listen(9000)
    .on('listening', function () {
      console.log('Started connect web server on http://localhost:9000');
    });
});

gulp.task('serve', ['connect', 'watch'], function () {
  require('opn')('http://localhost:9000');
});

// inject bower components
gulp.task('wiredep', function () {
  var wiredep = require('wiredep').stream;

  gulp.src('app/styles/*.scss')
    .pipe(wiredep())
    .pipe(gulp.dest('app/styles'));

  gulp.src('app/*.html')
    .pipe(gulp.dest('app'));
});

gulp.task('watch', ['connect'], function () {
  $.livereload.listen();

  // watch for changes
  gulp.watch([
    'app/*.html',
    '.tmp/styles/**/*.css',
    '.tmp/*.html',
    'app/scripts/**/*.js',
    'app/images/**/*'
  ]).on('change', $.livereload.changed);

  gulp.watch('app/styles/**/*.scss', ['styles']);
  gulp.watch('app/src/**/*.hbs', ['metalsmith']);
  gulp.watch('bower.json', ['wiredep']);
});

gulp.task('build', ['jshint', 'html', 'images', 'fonts', 'extras'], function () {
  return gulp.src('dist/**/*').pipe($.size({title: 'build', gzip: true}));
});

gulp.task('default', ['clean'], function () {
  gulp.start('build');
});
