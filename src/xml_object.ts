import * as CONST from "./const";
import { XmlNodeType } from "./xml";
import { XmlError, XE } from "./error";
import { SelectSingleNode, Parse } from "./utils";
import { APPLICATION_XML } from "./xml";

const DEFAULT_ROOT_NAME = "xml_root";

export class XmlObject implements IXmlSerializable {

    protected static attributes: AssocArray<XmlAttributeType<any>>;
    protected static elements: AssocArray<XmlChildElementType<any>>;
    protected static prefix: string | null;
    protected static namespaceURI: string | null;
    protected static localName: string;

    /**
     * XmlElement
     * undefined - class initialized
     * null - has some changes
     * element - has cached element
     * 
     * @protected
     * @type {(Element | null | undefined)}
     * @memberOf XmlObject
     */
    protected element?: Element | null;
    protected prefix = this.GetStatic().prefix || null;

    protected localName = this.GetStatic().localName;
    protected namespaceURI = this.GetStatic().namespaceURI;

    get Element() {
        return this.element;
    }

    get Prefix() {
        return this.prefix;
    }
    set Prefix(value: string | null) {
        this.prefix = value;
    }

    get LocalName(): string {
        return this.localName!;
    }
    get NamespaceURI(): string | null {
        return this.namespaceURI || null;
    }

    protected GetStatic(): XmlSchema {
        return this.constructor;
    }

    protected GetPrefix(): string {
        return (this.Prefix) ? this.prefix + ":" : "";
    }

    HasChanged() {
        const self = this.GetStatic();

        // Check changed elements
        if (self.items)
            for (let key in self.items) {
                const item: XmlChildElementType<any> = self.items[key];
                const value = (this as any)[key];

                if (item.parser && value && value.HasChanged())
                    return true;

            }
        return this.element === null;
    }


    protected OnGetXml(element: Element) { }

    GetXml(hard?: boolean): Element | null {
        if (!(hard || this.HasChanged()))
            return this.element || null;

        const doc = this.CreateDocument();
        const el = this.CreateElement();
        const self = this.GetStatic();

        const localName: string = this.localName!;

        // Add attributes
        if (self.items) {
            for (let key in self.items) {
                const _parser = (this as any)[key];
                const selfItem = self.items[key];
                switch (selfItem.type) {
                    case CONST.CONTENT: {
                        let schema: XmlContentType<any> = selfItem;
                        let value = (schema.converter) ? schema.converter.get(_parser) : _parser;
                        if (schema.required && (value === null || value === void 0))
                            throw new XmlError(XE.CONTENT_MISSING, localName);

                        if (schema.defaultValue !== _parser || schema.required)
                            el.textContent = value;
                        break;
                    }
                    case CONST.ATTRIBUTE: {
                        let schema: XmlAttributeType<any> = selfItem;
                        let value = (schema.converter) ? schema.converter.get(_parser) : _parser;
                        if (schema.required && (value === null || value === void 0))
                            throw new XmlError(XE.ATTRIBUTE_MISSING, schema.localName, localName);

                        // attr value
                        if (schema.defaultValue !== _parser || schema.required)
                            if (!schema.namespaceURI)
                                el.setAttribute(schema.localName!, value);
                            else
                                el.setAttributeNS(schema.namespaceURI, schema.localName!, value);
                        break;
                    }
                    case CONST.ELEMENT: {
                        // Add elements
                        let schema = selfItem as XmlChildElementType<any>;
                        let node: Element | null = null;

                        if (schema.parser) {
                            if ((schema.required && !_parser) ||
                                (schema.minOccurs && !_parser.Count))
                                throw new XmlError(XE.ELEMENT_MISSING, _parser.localName, localName);

                            if (_parser)
                                node = _parser.GetXml(_parser.element === void 0 && (schema.required || _parser.Count));
                        }
                        else {
                            let value = (schema.converter) ? schema.converter.get(_parser) : _parser;
                            if (schema.required && value === void 0)
                                throw new XmlError(XE.ELEMENT_MISSING, schema.localName, localName);
                            if (_parser !== schema.defaultValue || schema.required) {
                                if (!schema.namespaceURI)
                                    node = doc.createElement(`${schema.prefix ? schema.prefix + ":" : ""}${schema.localName}`);
                                else {
                                    node = doc.createElementNS(schema.namespaceURI, `${schema.prefix ? schema.prefix + ":" : ""}${schema.localName}`);
                                }
                                node!.textContent = value;
                            }
                        }

                        if (node) {
                            if (schema.noRoot) {
                                let els: Element[] = [];
                                // no root
                                for (let i = 0; i < node.childNodes.length; i++) {
                                    const colNode = node.childNodes.item(i);
                                    if (colNode.nodeType === XmlNodeType.Element)
                                        els.push(colNode as Element);
                                }
                                if (els.length < schema.minOccurs || els.length > schema.maxOccurs)
                                    throw new XmlError(XE.COLLECTION_LIMIT, _parser.localName, self.localName);
                                els.forEach(e => el.appendChild(e.cloneNode(true)));
                            }
                            else if (node.childNodes.length < schema.minOccurs || node.childNodes.length > schema.maxOccurs)
                                throw new XmlError(XE.COLLECTION_LIMIT, _parser.localName, self.localName);
                            else
                                el.appendChild(node);
                        }
                        break;
                    }
                }
            }
        }

        // Set custom
        this.OnGetXml(el);

        // Cache compiled elements
        this.element = el;
        return el;
    }

    protected OnLoadXml(element: Element) {
    }

    static LoadXml<T extends XmlObject>(this: { new (): T }, param: string | Element) {
        let xml = new this();
        xml.LoadXml(param);
        return xml;
    }

    LoadXml(param: string | Element) {
        let element: Element;
        if (typeof param === "string") {
            const doc = Parse(param);
            element = doc.documentElement;
        }
        else
            element = param;

        if (!element) {
            throw new XmlError(XE.PARAM_REQUIRED, "element");
        }

        const self = this.GetStatic();
        const localName = this.localName!;

        // tslint:disable-next-line:triple-equals
        if (!((element.localName === localName) && (element.namespaceURI == this.NamespaceURI)))
            throw new XmlError(XE.ELEMENT_MALFORMED, localName);

        // Get attributes
        if (self.items) {
            for (let key in self.items) {
                let selfItem = self.items[key];
                switch (selfItem.type) {
                    case CONST.CONTENT: {
                        let schema: XmlContentType<any> = selfItem;

                        if (schema.required && !element.textContent)
                            throw new XmlError(XE.CONTENT_MISSING, localName);

                        if (!element.textContent)
                            (this as any)[key] = schema.defaultValue;
                        else {
                            let value = schema.converter ? schema.converter.set(element.textContent) : element.textContent;
                            (this as any)[key] = value;
                        }
                        break;
                    }
                    case CONST.ATTRIBUTE: {
                        let schema: XmlAttributeType<any> = selfItem;

                        let hasAttribute: () => boolean;
                        let getAttribute: () => string | null;
                        if (schema.namespaceURI) {
                            hasAttribute = element.hasAttributeNS.bind(element, schema.namespaceURI, schema.localName);
                            getAttribute = element.getAttributeNS.bind(element, schema.namespaceURI, schema.localName);
                        }
                        else {
                            hasAttribute = element.hasAttribute.bind(element, schema.localName);
                            getAttribute = element.getAttribute.bind(element, schema.localName);
                        }

                        if (schema.required && !hasAttribute())
                            throw new XmlError(XE.ATTRIBUTE_MISSING, schema.localName, localName);

                        if (!hasAttribute())
                            (this as any)[key] = schema.defaultValue;
                        else {
                            let value = schema.converter ? schema.converter.set(getAttribute() !) : getAttribute() !;
                            (this as any)[key] = value;
                        }
                        break;
                    }
                    case CONST.ELEMENT: {
                        // Get element
                        const schema: XmlChildElementType<any> = selfItem;
                        // noRoot
                        if (schema.noRoot) {
                            if (!schema.parser)
                                throw new XmlError(XE.XML_EXCEPTION, `Schema for '${schema.localName}' with flag noRoot must have 'parser'`);
                            const col: XmlCollection<any> = new schema.parser() as any;
                            if (!(col instanceof XmlCollection))
                                throw new XmlError(XE.XML_EXCEPTION, `Schema for '${schema.localName}' with flag noRoot must have 'parser' like instance of XmlCollection`);
                            (col as any).OnLoadXml(element); // protected member
                            delete col.element; // reset cache status

                            if (col.Count < schema.minOccurs || col.Count > schema.maxOccurs)
                                throw new XmlError(XE.COLLECTION_LIMIT, (schema.parser as any).localName, localName);
                            (this as any)[key] = col;
                            continue;
                        }

                        // Get element by localName
                        let foundElement: Element | null = null;
                        for (let i = 0; i < element.childNodes.length; i++) {
                            const node = element.childNodes.item(i);
                            if (node.nodeType !== XmlNodeType.Element)
                                continue;
                            const el = node as Element;
                            if (el.localName === schema.localName &&
                                // tslint:disable-next-line:triple-equals
                                el.namespaceURI == schema.namespaceURI) {
                                foundElement = el;
                                break;
                            }
                        }

                        // required
                        if (schema.required && !foundElement)
                            throw new XmlError(XE.ELEMENT_MISSING, schema.parser ? (schema.parser as any).localName : schema.localName, localName);

                        if (!schema.parser) {

                            // simple element
                            if (!foundElement)
                                (this as any)[key] = schema.defaultValue;
                            else {
                                let value = schema.converter ? schema.converter.set(foundElement.textContent!) : foundElement.textContent;
                                (this as any)[key] = value;
                            }
                        }
                        else {
                            // element
                            if (foundElement) {
                                const value = new schema.parser() as IXmlSerializable;
                                (value as any).localName = schema.localName;
                                (value as any).namespaceURI = schema.namespaceURI;
                                (this as any)[key] = value;
                                value.LoadXml(foundElement);
                            }
                        }
                        break;
                    }
                }
            }
        }

        // Get custom
        this.OnLoadXml(element);

        this.prefix = element.prefix || "";
        this.element = element;
    }

    /**
     * Returns current Xml as string
     * - if element was inicialized without changes, returns empty string
     */
    toString(): string {
        let xml = this.GetXml();
        return xml ? new XMLSerializer().serializeToString(xml) : "";
    }

    static GetElement(element: Element, name: string, required: boolean = true) {
        let xmlNodeList = element.getElementsByTagName(name);
        if (required && xmlNodeList.length === 0) {
            throw new XmlError(XE.ELEMENT_MISSING, name, element.localName);
        }
        return xmlNodeList[0] || null;
    }
    GetElement(name: string, required: boolean = true) {
        if (!this.element)
            throw new XmlError(XE.NULL_PARAM, this.localName);
        return XmlObject.GetElement(this.element, name, required);
    }

    static GetAttribute(element: Element, attrName: string, defaultValue: string | null, required: boolean = true) {
        if (element.hasAttribute(attrName)) {
            return element.getAttribute(attrName);
        }
        else {
            if (required)
                throw new XmlError(XE.ATTRIBUTE_MISSING, attrName, element.localName);
            return defaultValue;
        }
    }
    protected GetAttribute(name: string, defaultValue: string | null, required: boolean = true) {
        if (!this.element)
            throw new XmlError(XE.NULL_PARAM, this.localName);
        return XmlObject.GetAttribute(this.element, name, defaultValue, required);
    }

    static GetElementById(document: Document, idValue: string): Element | null;
    static GetElementById(element: Element, idValue: string): Element | null;
    static GetElementById(node: Node, idValue: string) {
        if ((node == null) || (idValue == null))
            return null;

        // this works only if there's a DTD or XSD available to define the ID
        let xel: Node | null = null;
        if (node.nodeType === XmlNodeType.Document)
            xel = (node as Document).getElementById(idValue);
        if (xel == null) {
            // search an "undefined" ID
            xel = SelectSingleNode(node, `//*[@Id='${idValue}']`);
            if (xel == null) {
                xel = SelectSingleNode(node, `//*[@ID='${idValue}']`);
                if (xel == null) {
                    xel = SelectSingleNode(node, `//*[@id='${idValue}']`);
                }
            }
        }
        return xel as Element;
    }

    protected CreateElement(document?: Document, localName?: string, namespaceUri: string | null = null, prefix: string | null = null) {
        if (!document)
            document = this.CreateDocument() !;
        localName = localName || this.localName;
        namespaceUri = namespaceUri || this.NamespaceURI;
        prefix = prefix || this.prefix;

        const xn = document!.createElementNS(this.NamespaceURI, (prefix ? `${prefix}:` : "") + localName);
        document!.importNode(xn, true);

        return xn;
    }

    protected CreateDocument() {
        return XmlObject.CreateDocument(
            this.localName,
            this.NamespaceURI,
            this.Prefix);
    }

    /**
     * Creates new instance of XmlDocument with given name of root element
     * @param  {string} root Name of root element
     * @param  {string} namespaceUri
     * @param  {string} prefix
     * @returns Document
     */
    static CreateDocument(root: string = DEFAULT_ROOT_NAME, namespaceUri: string | null = null, prefix: string | null = null): Document {
        let name_prefix = "",
            ns_prefix = "",
            namespace_uri = "";
        if (prefix) {
            name_prefix = prefix + ":";
            ns_prefix = ":" + prefix;
        }
        if (namespaceUri) {
            namespace_uri = ` xmlns${ns_prefix}="${namespaceUri}"`;
        }
        let name = `${name_prefix}${root}`;
        let doc = new DOMParser().parseFromString(`<${name}${namespace_uri}></${name}>`, APPLICATION_XML);
        return doc;
    }

    static GetChildren(node: Node, localName: string, nameSpace?: string): Element[] {
        node = (<Document>node).documentElement || node;
        let res: Element[] = [];
        for (let i = 0; i < node.childNodes.length; i++) {
            let child = node.childNodes[i];
            if (child.nodeType === XmlNodeType.Element && child.localName === localName && (child.namespaceURI === nameSpace || !nameSpace)) {
                res.push(child as Element);
            }
        }
        return res;
    }

    GetChildren(localName: string, nameSpace?: string) {
        if (!this.element)
            throw new XmlError(XE.NULL_PARAM, this.localName);
        return XmlObject.GetChildren(this.element, localName, nameSpace || this.NamespaceURI || undefined);
    }

    static GetFirstChild(node: Node, localName: string, nameSpace?: string): Element | null {
        node = (<Document>node).documentElement || node;
        for (let i = 0; i < node.childNodes.length; i++) {
            let child = node.childNodes[i];
            if (child.nodeType === XmlNodeType.Element && child.localName === localName && (child.namespaceURI === nameSpace || !nameSpace)) {
                return child as Element;
            }
        }
        return null;
    }
    static GetChild(node: Element, localName: string, nameSpace?: string, required = true): Element | null {
        for (let i = 0; i < node.childNodes.length; i++) {
            let child = node.childNodes[i];
            if (child.nodeType === XmlNodeType.Element && child.localName === localName && (child.namespaceURI === nameSpace || !nameSpace)) {
                return child as Element;
            }
        }
        if (required)
            throw new XmlError(XE.ELEMENT_MISSING, localName, node.localName);
        return null;
    }
    protected GetChild(localName: string, required = true): Element | null {
        if (!this.element)
            throw new XmlError(XE.NULL_PARAM, this.localName);
        return XmlObject.GetChild(this.element, localName, this.NamespaceURI || undefined, required);
    }

    GetFirstChild(localName: string, namespace?: string) {
        if (!this.element)
            throw new XmlError(XE.NULL_PARAM, this.localName);
        return XmlObject.GetFirstChild(this.element, localName, namespace);
    }

    IsEmpty() {
        return this.Element === void 0;
    }

}

import { XmlCollection } from "./xml_collection";