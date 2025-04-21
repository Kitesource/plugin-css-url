const { extname, basename, relative,resolve ,dirname,join } = require( 'path')
const { statSync, readFileSync, createReadStream, createWriteStream,writeFileSync } = require( 'fs')
const hasha = require('hasha')
const {importUrl,flagStartReg,flagEndReg} = require('./import-loader')
const { mkdir, extToOutput} = require('./utils')
const mimeMap = {
	'.jpg':  'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.png':  'image/png',
	'.gif':  'image/gif',
    '.svg':  'image/svg+xml',
    '.webp': 'image/webp',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
}

const startUrlReg = /\s*url\(\s*('|")(.*?)\1\s*\)/
const startUrlReg2 = /(\s*)url\(([^'"]*?)\)/
const startHttp = /^\s*http/
// Exclude font file url ? and # suffixes
const fontFileSuffixes = /[\?#].*$/




// handleOptions 函数用于处理配置选项，并根据配置对 CSS 文件中的资源 URL 进行处理。
// 参数:
// - options: 包含配置选项的对象，如资源大小限制、是否使用哈希命名、路径分隔符等。
// - root: PostCSS 的根节点对象，代表 CSS 文件的语法树。
// - file: 当前处理的 CSS 文件的路径。
function handleOptions({
    limit,
    hash,
    slash,
    cssOutput,
    imgOutput,
    imgExtensions,
    fontOutput,
    fontExtensions
},root,file){

    // writeFile 函数用于根据资源的大小和配置，将资源转换为 Base64 编码或复制到指定输出目录，并更新 CSS 节点的 URL。
    // 参数:
    // - urlRPath: 资源的相对路径。
    // - nodeMap: 包含资源 URL 的 CSS 节点。
    // - originalValue: 原始的 URL 值。
    // - originalValueDeleteSuf: 去除字体文件后缀的原始 URL 值。
    function writeFile(urlRPath,nodeMap,originalValue,originalValueDeleteSuf){
        // 获取资源文件的扩展名
        const ext = extname(urlRPath)
        // 根据扩展名确定资源的输出目录
        const output = extToOutput(ext, imgOutput,imgExtensions,fontOutput,fontExtensions)
        // 如果没有对应的输出目录，则不处理该资源
        if(!output) return null;
        
        // 解析资源的绝对路径
        const urlAPath = resolve(file,'..',urlRPath)
        // 如果资源大小小于等于限制值，则将其转换为 Base64 编码
        if (statSync(urlAPath).size <= limit) { 
    
            const ImgBase64 =  `data:${mimeMap[ext]};base64,${readFileSync(urlAPath, 'base64')}`; // 使用 Base64 编码
    
            nodeMap.value = `url('${ImgBase64}')`
    
        } else {
            // 获取输出目录的相对路径，并统一路径分隔符为斜杠
            let outputPath = relative('./', output) || '';
            outputPath = outputPath.replace(/\\/g,'/')
            // 创建输出目录
            mkdir(outputPath)
            // 获取资源文件的文件名
            let name = basename(urlAPath);
            // 如果启用了哈希命名，则生成哈希值并添加到文件名中
            if (hash) {
                const code = readFileSync(urlAPath).toString();
                const hash = hasha(code, { algorithm: 'md5' });
                name =  `${basename(urlAPath, ext)}-${hash}${ext}`;
            }
            // 拼接输出文件的完整路径
            const outputFile = `${outputPath}/${name}`;
    
            // 将资源文件复制到输出目录
            createReadStream(urlAPath).pipe(createWriteStream(outputFile));
            
            if(cssOutput){
                // 计算输出文件相对于 CSS 输出目录的相对路径
                let relativePath = relative(cssOutput,outputFile);

                relativePath = relativePath.replace(/\\/g,'/');
                // 更新 CSS 节点的 URL 值
                const urlIn = originalValue.replace(originalValueDeleteSuf,`${slash ? './' : ''}${relativePath}`)
                nodeMap.value = nodeMap.value.replace(originalValue,urlIn)
              
            }else {
                // 从输出文件路径中提取相对路径
                let baseIndex = outputFile.indexOf('/');
                baseIndex = baseIndex !== -1 ? baseIndex + 1 : 0;
                // 更新 CSS 节点的 URL 值
                const urlIn = originalValue.replace(originalValueDeleteSuf,`${slash ? './' : ''}${outputFile.slice(baseIndex)}`)
                nodeMap.value = nodeMap.value.replace(originalValue,urlIn)
            }
    
            
        }
    }

    // 获取 CSS 语法树的所有节点
    const nodes = root.nodes
    
    // 存储需要删除的节点的索引
    const deleteNodes = [];
    // 遍历所有节点
    for(let i=0;i<nodes.length;i++){
        let flagStartMatch = null
        // 如果节点是注释，并且匹配起始标志
        if(nodes[i].type === 'comment' && (flagStartMatch = nodes[i].text.match(flagStartReg))){
            // 记录需要删除的节点索引
            deleteNodes.push(i)
            
            // 继续遍历后续节点，直到找到结束标志
            for(i++;!(nodes[i].text && nodes[i].text.match(flagEndReg));i++){
                // 如果节点没有子节点，则跳过
                if(!nodes[i].nodes) continue;

                // 递归处理子节点中的资源 URL
                cycleFun(nodes[i].nodes,(urlRPathImport,nodeMap)=>{
                    // 去除字体文件后缀
                    const urlRPathImportDeleteSuf = urlRPathImport.replace(fontFileSuffixes,'')

                    // 拼接资源的完整相对路径
                    const urlRPath = join(dirname(flagStartMatch[1]),urlRPathImportDeleteSuf).replace('\\','/')
                    // 处理资源 URL
                    writeFile(urlRPath,nodeMap,urlRPathImport,urlRPathImportDeleteSuf)
                })
               
            }
            // 记录需要删除的节点索引
            deleteNodes.push(i)
        }

        // 如果节点是规则或 at 规则，则处理其中的资源 URL
        if(nodes[i].nodes && nodes[i].type === 'rule' || nodes[i].type === 'atrule'){
            cycleFun(nodes[i].nodes,(urlRPath,nodeMap)=>{
                // 去除字体文件后缀
                const urlRPathImportDeleteSuf = urlRPath.replace(fontFileSuffixes,'')
                // 处理资源 URL
                writeFile(urlRPath,nodeMap,urlRPath,urlRPathImportDeleteSuf)
            })
        }

       

    }
    // 过滤掉需要删除的节点    
    root.nodes = root.nodes.filter((item,index)=>!deleteNodes.includes(index))


  
}




// cycleFun 函数用于遍历节点列表，查找包含 URL 的节点，并对每个匹配到的 URL 执行回调函数。
// 参数:
// - nodes: 待遍历的节点列表，通常是 CSS 语法树中的节点数组。
// - callback: 回调函数，当找到匹配的 URL 时会被调用，接收两个参数：URL 的相对路径和包含该 URL 的节点。
function cycleFun(nodes,callback) {
    // 过滤出节点列表中包含 URL 的节点，使用 startUrlReg 和 startUrlReg2 正则表达式进行匹配。
    if (nodes && nodes.length) {
        const urlList = nodes.filter(item=>item.value && (item.value.match(startUrlReg) || item.value.match(startUrlReg2)))
        // 遍历包含 URL 的节点列表
        urlList.forEach(item=>{
            // 用于存储匹配后剩余的字符串
            let nextStr = null;
            // 使用循环进行多次匹配，直到没有更多匹配项为止。
            // 每次循环使用 startUrlReg 或 startUrlReg2 正则表达式进行匹配。
            for(
                let match = (item.value.match(startUrlReg) || item.value.match(startUrlReg2));
                match != null;
                match = nextStr.match(startUrlReg) || nextStr.match(startUrlReg2)){
                    // 截取匹配项之后的剩余字符串，用于下一次匹配。
                    nextStr = match['input'].slice(match['index']+match[0].length)
                    // 提取匹配到的 URL 相对路径
                    let urlRPath = match[2]

                    // 如果 URL 以 http 开头，则跳过该 URL，不执行回调函数。
                    if(urlRPath.match(startHttp)) return null;
                    
                    // 调用回调函数，传入 URL 相对路径和包含该 URL 的节点。
                    callback(urlRPath,item)

            }

        })
    }
}


module.exports.cssUrl = ({
    imgOutput,
    fontOutput,
    cssOutput,
    imgExtensions = /\.(png|jpg|jpeg|gif|svg)$/,
    fontExtensions = /\.(ttf|woff|woff2|eot)$/,
    limit = 8192,
    hash = false,
    slash = false
}) => {
    return {
        postcssPlugin: 'css-url',
        Once (root) {
            const file = root.source.input.file
            handleOptions({limit,hash,slash,cssOutput,imgOutput,imgExtensions,fontOutput,fontExtensions},root,file) 
        }
    }
   
}



module.exports.postcss = true

module.exports.importLoader = importUrl