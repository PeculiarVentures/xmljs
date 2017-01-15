import { XmlNodeType, APPLICATION_XML } from "./xml";

export type SelectNodes = (node: Node, xpath: string) => Node[];

let xpath: SelectNodes = (node: Node, xpath: string) => {
    throw new Error("Not implemented");
};

// Fix global
let _w: any;
if (typeof self === "undefined") {
    _w = global;
    const xmldom = require("xmldom-alpha");
    xpath = require("xpath.js");
    _w.XMLSerializer = xmldom.XMLSerializer;
    _w.DOMParser = xmldom.DOMParser;
    _w.DOMImplementation = xmldom.DOMImplementation;
    _w.document = new DOMImplementation().createDocument("http://www.w3.org/1999/xhtml", "html", null!);
}
else
    _w = self;

function SelectNodesEx(node: Node, xpath: string): Node[] {
    let doc: Document = node.ownerDocument == null ? node as Document : node.ownerDocument;
    let nsResolver = document.createNSResolver(node.ownerDocument == null ? (node as Document).documentElement : node.ownerDocument.documentElement);
    let personIterator = doc.evaluate(xpath, node, nsResolver, XPathResult.ANY_TYPE, null!);
    let ns: Node[] = [];
    let n: Node;
    while (n = personIterator.iterateNext())
        ns.push(n);
    return ns;
}

export const Select: SelectNodes = (typeof self !== "undefined") ? SelectNodesEx : xpath;

export function Parse(xmlstring: string) {
    return new DOMParser().parseFromString(xmlstring, APPLICATION_XML);
}

/**
 * Returns signle Node from given Node
 * 
 * @export
 * @param {Node} node
 * @param {string} path
 * @returns
 */
export function SelectSingleNode(node: Node, path: string) {
    let ns = Select(node, path);
    if (ns && ns.length > 0)
        return ns[0];
    return null;
}

function _SelectNamespaces(node: Node, selectedNodes: AssocArray<string> = {}) {
    if (node && node.nodeType === XmlNodeType.Element) {
        const el = node as Element;
        if (el.namespaceURI && el.namespaceURI !== "http://www.w3.org/XML/1998/namespace" && !selectedNodes[el.prefix || ""])
            selectedNodes[el.prefix ? el.prefix : ""] = node.namespaceURI!;
        for (let i = 0; i < node.childNodes.length; i++) {
            let childNode = node.childNodes.item(i);
            if (childNode && childNode.nodeType === XmlNodeType.Element)
                _SelectNamespaces(childNode, selectedNodes);
        }
    }
}

export function SelectNamespaces(node: Element) {
    let attrs: AssocArray<string> = {};
    _SelectNamespaces(node, attrs);
    return attrs;
}

export function assign(target: any, ...sources: any[]) {
    let res = arguments[0];
    for (let i = 1; i < arguments.length; i++) {
        let obj = arguments[i];
        for (let prop in obj) {
            res[prop] = obj[prop];
        }
    }
    return res;
}