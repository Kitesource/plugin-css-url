const importReg = /@import\s+('|")(.*?)\1\s*;/    
const flagStart = 'start sixian-css-url import path:';
const flagEnd = 'end sixian-css-url'
// 此代码将一个名为 importUrl 的对象导出到模块中，该对象用于处理 CSS 相关文件中的 @import 语句。
// 具体功能是在每个 @import 语句前后添加特定注释标记。

// 导出一个名为 importUrl 的对象
module.exports.importUrl =  {
    // 插件的名称
    name : 'import-url',
    // 一个正则表达式，用于匹配文件扩展名，表明该插件处理的文件类型
    test: /\.(sass|scss|less|styl|stylus|css)$/,
    // 处理匹配文件的函数，接收一个包含 code 和 map 属性的对象作为参数
    process({code,map}){
        // 初始化索引变量，用于记录处理的位置
        let index = 0, 
            // 初始化匹配结果变量
            match = null, 
            // 复制代码内容到 str 变量，用于后续匹配操作
            str = code;
        // 使用 while 循环查找代码中所有的 @import 语句
        while (match = str.match(importReg)){
            // 提取 @import 语句中的路径
            const path = match[2];
            // 获取匹配到的 @import 语句的长度
            const matchStrLength = match[0].length;
          
            // 更新索引位置，指向当前匹配到的 @import 语句的起始位置
            index += match['index'];
            // 在 @import 语句前插入起始注释标记
            code = code.slice(0,index) + comment(flagStart + path) + code.slice(index)
            // 更新索引位置，跳过插入的起始注释标记和 @import 语句
            index += comment(flagStart + path).length + matchStrLength
            // 在 @import 语句后插入结束注释标记
            code = code.slice(0,index) + comment(flagEnd) + code.slice(index)
            // 更新索引位置，跳过插入的结束注释标记
            index += comment(flagEnd).length
            // 更新 str 变量，从当前索引位置开始截取剩余代码，继续查找后续的 @import 语句
            str = code.slice(index)
        }
        // 返回处理后的代码和原始的 source map
        return {
            code : code,
            map : map
        }
    }
}
module.exports.flagStartReg = new RegExp(`${flagStart}(.*)`);
module.exports.flagEndReg = new RegExp(`${flagEnd}(.*)`);

function comment(str){
    return `/*${str}*/`
}