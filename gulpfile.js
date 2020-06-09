// 实现这个项目的构建任务

// 命令行目录
const cwd = process.cwd()
const {src, dest, parallel, series, watch} = require('gulp')
const del = require('del')

// 自动载入所有的gulp插件
const loadPlugins = require('gulp-load-plugins')
const plugins = loadPlugins()

// 热更新插件
const browserSync = require('browser-sync')
// 自动创建开发服务器
const bs = browserSync.create()

// 默认文件路径配置
let config = {
    build: {
        src: 'src',
        dist: 'dist',
        temp: 'temp',
        public: 'public',
        paths: {
            styles: 'assets/styles/*.scss',
            scripts: 'assets/scripts/*.js',
            pages: '*.html',
            images: 'assets/images/**',
            fonts: 'assets/fonts/**'
        }
    }
}

try {
    // 获取命令行路径下的pages.config.js文件
    const loadConfig = require(`${cwd}/pages.config.js`)
    const deployConfig = require(`${cwd}/deploy.config.js`)
    // 合并默认配置为新的配置文件
    config = Object.assign({}, config, loadConfig, deployConfig)
    console.log(config)
} catch (error) {
    console.log(error)
}

// 使用del插件清空文件: dist 放置的是编译后的文件，temp 放置的是编译时的临时文件
const clean = () => {
    return del([config.build.dist, config.build.temp])
}

const path = require('path')
const Comb = require('csscomb')
const standard = require('standard')
const lint = done => {
    const comb = new Comb(require('./csscomb.json'))
    comb.processPath(config.build.src)
    const cwd = path.join(__dirname, config.build.src)
    standard.lintFiles(config.build.paths.scripts, { cwd, fix: true }, done)
}

// 使用gulp-sass插件样式编译sass文件 plugins.sass使用gulp-sass
const style = () => {
    // src 创建文件写入流,接受文件路径,第二个配置为配置选项为对象，base：配置相同的路径,cwd：从哪个文件夹开始查找
    return src(config.build.paths.styles, {base: config.build.src, cwd: config.build.src})
        // 使用gulp-sass编译sass文件 outputStyle:'expanded' 生成完全展开的代码
        .pipe(plugins.sass({ outputStyle:'expanded'}))
        // dest 文件写入流到temp临时文件夹
        .pipe(dest(config.build.temp))
        .pipe(bs.reload({stream: true}))
}

// 使用gulp-babel @babel/core脚本编译js文件 plugins.babel使用gulp-babel
const script = () => {
    // src 创建文件写入流,接受文件路径,第二个配置为配置选项为对象，base：配置相同的路径,cwd：从哪个文件夹开始查找
    return src(config.build.paths.scripts,{base: config.build.src, cwd: config.build.src})
        // 使用 @babel/preset-env 转换新特性
        .pipe(plugins.babel({ presets: [require('@babel/preset-env')]}))
        // dest 文件写入流到temp临时文件夹
        .pipe(dest(config.build.temp))
        .pipe(bs.reload({stream: true}))
}

// 使用gulp-swig插件编辑html文件 plugins.swig使用gulp-swig
const page = () => {
    // src 创建文件写入流,接受文件路径,第二个配置为配置选项为对象，base：配置相同的路径,cwd：从哪个文件夹开始查找
    return src(`**/${config.build.paths.pages}`, {base: config.build.src, cwd: config.build.src})
        // data 插入模板的配置选项,使用pages.config.js导出的data
        // cacha:false 防止模板引擎缓存机制导致页面不变化
        .pipe(plugins.swig({data:config.data, defaults:{cache:false}}))
        // dest 文件写入流到temp临时文件夹
        .pipe(dest(config.build.temp))
        .pipe(bs.reload({stream: true}))
}

// 使用gulp-imagemin插件压缩图片及字体文件 plugins.imageMin使用gulp-imagemin
// 图片及字体文件压缩后可直接放入dist中，无需二次编译压缩
const image = () => {
    return src(config.build.paths.images, {base: config.build.src, cwd: config.build.src})
        .pipe(plugins.imagemin())
        // dest 文件写入流到dist文件夹
        .pipe(dest(config.build.dist))
}
const font = () => {
    return src(config.build.paths.fonts, {base: config.build.src, cwd: config.build.src})
        .pipe(plugins.imagemin())
        // dest 文件写入流到dist文件夹
        .pipe(dest(config.build.dist))
}

// 不需要转换的文件直接从public文件夹写入dist文件夹
const extra = () => {
    return src('**', {base: config.build.public, cwd: config.build.public})
        .pipe(dest(config.build.dist))
}

// 创建热更新服务
const serve = () => {
    // watch 方法接收两个参数 监听的路径和执行的命令
    // 监听styles、scripts、pages文件，若发生修改则直接执行对应的指令
    // 在每个执行指令结尾都有bs.reload对浏览器重新发起请求
    watch(config.build.paths.styles, {cwd: config.build.src}, style)
    watch(config.build.paths.scripts, {cwd: config.build.src}, script)
    watch(config.build.paths.pages, {cwd: config.build.src}, page)

    // 静态、图片文件在开发阶段压缩会影响效率，所以直接使用未压缩的文件，在上线前再将文件压缩上传
    // 图片文件发生修改直接推上浏览器，不用重新压缩
    watch([
        config.build.paths.images,
        config.build.paths.fonts,
    ],{
        cwd: config.build.src
    }, bs.reload)
  
    // public文件夹中的静态文件发生改变也推上浏览器
    watch([
        '**'
    ],{
        cwd: config.build.public
    }, bs.reload)
  
    bs.init({
        // 弹出提示是否连接完毕
        notify: false,
        // 默认端口
        port: 2080,
        // 监听文件的修改自动热更新， dist下所有文件被修改会自动更新
        files: `${config.build.dist}/**`,
        // 是否自动打开网页
        open: false,
        server: {
            // 如果文件找不到，则会向后在temp、src、public文件夹进行查找
            // 所有静态、图片文件在dist目录找不到会在这个列表中进行查找，所以在开发阶段可以先不必要压缩文件至dist目录
            baseDir: [config.build.temp, config.build.src, config.build.public],
            // 将所有对/node_modules的请求路径都改为node_modules的路径
            routes: {
            '/node_modules': 'node_modules'
            }
        }
    })
}

// 引用依赖,对html文件内的依赖进行处理压缩
const useref = () => {
    // 对 temp 临时文件夹下的 html 进行压缩
    return src(`**/${config.build.paths.pages}`, {base: config.build.temp ,cwd: config.build.temp})
        .pipe(plugins.useref({searchPath: [config.build.temp, '.']}))
        // 压缩依赖中的 html css js 文件
        .pipe(plugins.if(/\.js$/, plugins.uglify()))
        .pipe(plugins.if(/\.css$/, plugins.cleanCss()))
        .pipe(plugins.if(/\.html$/, plugins.htmlmin({
            // 对空白和换行折叠
            collapseWhitespace: true,
            // 压缩行内css代码
            minifyCSS: true,
            // 压缩行内js代码
            minifyJS: true
        })))
        // 将压缩完的文件输入到dist文件夹
        .pipe(dest(config.build.dist))
}

const upload = () => {
    return src('./dist/**/*')
        .pipe(plugins.ghPages());
}

// 整理 scss 和 js 文件
const link = parallel(style, script)

// 编译文件 因为 style, script, page 三个任务可以同时执行互不影响使用 parallel 方法组合任务
const compile = parallel(style, script, page)

// 上线前 先删除临时和目标文件夹，编译文件后引用依赖，并将静态文件压缩后输入到目标文件夹
const build = series(clean, parallel(extra, image, font, series(compile, useref))) 

// 在生产模式下运行项目
const start = series(build, serve)

// 开发时 先成为模块的编译，再开启服务器，使用 series 方法组合任务
const deploy = series(compile, upload)


module.exports = {
    link,
    lint,
    compile,
    serve,
    build,
    start,
    deploy,
    clean,
    upload
}