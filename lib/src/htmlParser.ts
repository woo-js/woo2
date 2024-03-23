

const tagRegex = /<\s*([^>\s]+)([^>]*)>([^<]*)<\/\s*\1\s*>/g;
const attrRegex = /(\S+)=["']?((?:(?!\/>|>).)+)/g;

export interface ITag {
    tagName:string,
    attributes:{[key:string]:string},
    content:string
}
// 解析html字符串，返回标签数组
export function parseHTML(html:string) {
    let match;
    let tags = [] as ITag[] ;

    while ((match = tagRegex.exec(html)) !== null) {
        let tag:ITag = { tagName: match[1], attributes: {}, content: match[3].trim() };
        let attrMatch;
        while ((attrMatch = attrRegex.exec(match[2])) !== null) {
            tag.attributes[attrMatch[1]] = attrMatch[2];
        }
        tags.push(tag);
    }
    return tags;
}