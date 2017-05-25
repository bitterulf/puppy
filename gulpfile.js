const config = require('dotenv').config();
const gulp = require('gulp');
const data = require('gulp-data');
const htmlbeautify = require('gulp-html-beautify');
const pug = require('gulp-pug');
const zip = require('gulp-zip');
const marked = require('marked');
const runSequence = require('run-sequence');
const through = require('through2');
const unirest = require('unirest');

const contentful = require('contentful');

const client = contentful.createClient({
    accessToken: process.env.CONTENTFUL_TOKEN,
    space: process.env.CONTENTFUL_SPACE,
})

const articleFilter = function(item) {
    return item.contentType == 'article';
}

const getArticles = function(cb) {
    client.getEntries({}).then((response) => {
        const items = response.items.map(function(item) {
            return {
                contentType: item.sys.contentType.sys.id,
                fields: item.fields
            };
        });

        cb(null, items.filter(articleFilter).map(function(item) {
            item.fields.content = marked(item.fields.content)
            return item;
        }));
    });
}

const upload = through.obj(function (file, enc, cb) {
	console.log(file.path);
	const host = process.env.BUCKET_HOST;
	const port = process.env.BUCKET_PORT;
	const route = process.env.BUCKET_UPLOAD_ROUTE;

	unirest.post('http://'+host+':'+port+'/'+route)
		.auth({
		  user: process.env.BUCKET_USERNAME,
		  pass: process.env.BUCKET_PASSWORD,
		  sendImmediately: true
		})
		.headers({'Content-Type': 'multipart/form-data'})
		.attach('file', file.path)
		.end(function (response) {
			console.log(response.body);
			cb(null);
	});
});

gulp.task('default', function buildHTML() {
	return gulp.src('views/*.pug')
		.pipe(data(function(file, cb) {
			getArticles(function(err, articles) {
				cb(err, {
					articles: articles
				});
			});
		}))
		.pipe(pug({
			locals: {
				title: 'puppy'
			}
		}))
		.pipe(htmlbeautify({
			indentSize: 2
		}))
		.pipe(gulp.dest('build/'));
});

gulp.task('pack', function buildHTML() {
	return gulp.src('build/*.*')
		.pipe(zip('page.zip'))
		.pipe(gulp.dest('deploy/'));
});

gulp.task('upload', function buildHTML() {
	return gulp.src('deploy/page.zip')
		.pipe(upload);
});

gulp.task('deploy', function(callback) {
	runSequence('default', 'pack', 'upload', callback);
});
