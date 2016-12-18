import * as assert from "assert";
import { XmlElement, XmlAttribute, XmlChildElement } from "../lib";
import { XmlObject, XmlCollection } from "../lib";

context("GetXml/LoadXml/HasChanged", () => {

    it("Simple", () => {
        @XmlElement({
            localName: "test",
            namespaceURI: "http://some.com",
        })
        class Test extends XmlObject {

            @XmlAttribute({ localName: "id", defaultValue: "1" })
            public Id: string;
            @XmlAttribute({ localName: "class", defaultValue: "2", required: true })
            public Class: string;

            @XmlChildElement({ localName: "algorithm", namespaceURI: "http://some.com", defaultValue: "3" })
            public Algorithm: string;
            @XmlChildElement({ localName: "method", namespaceURI: "http://some.com", defaultValue: "4", required: true })
            public Method: string;
        }

        let t = new Test();

        assert.equal(t.toString(), "", "initialized class should be empty");

        t.Id = "123";

        const xml = `<test id="123" class="2" xmlns="http://some.com"><method>4</method></test>`;
        assert.equal(t.toString(), xml);

        const p = new Test();
        p.LoadXml(xml);

        assert.equal(p.Id, "123");
        assert.equal(p.Class, "2");
        assert.equal(p.Algorithm, "3");
        assert.equal(p.Method, "4");
        assert.equal(p.HasChanged(), false);
    });

    it("With child element", () => {

        @XmlElement({
            localName: "child",
            namespaceURI: "http://some.com",
        })
        class Child extends XmlObject {
            @XmlAttribute({ localName: "id", defaultValue: "" })
            public Id: string;
        }

        @XmlElement({
            localName: "test",
            namespaceURI: "http://some.com",
        })
        class Test extends XmlObject {

            @XmlChildElement({ parser: Child })
            public Child: Child;
        }

        let t = new Test();

        assert.equal(t.toString(), "", "initialized class should be empty");
        assert.equal(t.HasChanged(), false);

        t.Child.Id = "1";

        const xml = `<test xmlns="http://some.com"><child id="1"/></test>`;

        assert.equal(t.HasChanged(), true);
        assert.equal(t.toString(), xml);
        assert.equal(t.HasChanged(), false);

        const p = Test.LoadXml(xml);

        assert.equal(!!p.Child, true);
        assert.equal(p.Child.Id, "1");
        assert.equal(p.Child.NamespaceURI, "http://some.com");
        assert.equal(p.HasChanged(), false);
    });

    it("With child XmlCollection", () => {

        @XmlElement({
            localName: "child",
            namespaceURI: "http://some.com",
        })
        class Child extends XmlObject {
            @XmlAttribute({ localName: "id", defaultValue: "" })
            public Id: string;
        }

        @XmlElement({
            localName: "childs",
            namespaceURI: "http://some.com",
            parser: Child,
        })
        class Childs extends XmlCollection<Child> {
        }

        @XmlElement({
            localName: "test",
            namespaceURI: "http://some.com",
        })
        class Test extends XmlObject {

            @XmlChildElement({ parser: Childs })
            public Childs: Childs;
        }

        let t = new Test();

        assert.equal(t.toString(), "", "initialized class should be empty");

        t.Childs.Add(new Child());

        const xml = `<test xmlns="http://some.com"><childs/></test>`;

        assert.equal(t.toString(), xml);

        const p = Test.LoadXml(xml);

        assert.equal(p.Childs.Count, 0);
        assert.equal(p.HasChanged(), false);
    });

    it("With child requierd XmlCollection", () => {

        @XmlElement({
            localName: "child",
            namespaceURI: "http://some.com",
        })
        class Child extends XmlObject {
            @XmlAttribute({ localName: "id", defaultValue: "" })
            public Id: string;
        }

        @XmlElement({
            localName: "childs",
            namespaceURI: "http://some.com",
            parser: Child,
        })
        class Childs extends XmlCollection<Child> {
        }

        @XmlElement({
            localName: "test",
            namespaceURI: "http://some.com",
        })
        class Test extends XmlObject {

            @XmlChildElement({ parser: Childs })
            public Childs: Childs;
            @XmlChildElement({ localName: "required", parser: Childs, minOccurs: 1 })
            public Childs2: Childs;
        }

        let t = new Test();

        assert.equal(t.toString(), "");
        // assert.throws(() => t.toString());

        t.Childs.Add(new Child());

        assert.throws(() => t.toString());
        t.Childs2.Add(new Child());
        assert.throws(() => t.toString());
        t.Childs2.Item(0) !.Id = "test";

        const xml = `<test xmlns="http://some.com"><childs/><required><child id="test"/></required></test>`;

        assert.equal(t.toString(), xml);

        const p = Test.LoadXml(xml);
        assert.equal(p.Childs.Count, 0);
        assert.equal(p.Childs2.LocalName, "required");
        assert.equal(p.Childs2.Count, 1);
        assert.equal(p.Childs2.Item(0) !.Id, "test");
        assert.equal(p.HasChanged(), false);
    });

});
