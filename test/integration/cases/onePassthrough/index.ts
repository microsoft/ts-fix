class Base {
  foo() {
    console.log("called foo in Base");
  }

  bar() {
    console.log("called bar in Base");
  }
}

class Derived extends Base {
  override foo() {
    console.log("called foo in Derived");
    super.foo();
  }

  override bar() {
    console.log("called bar in Derived");
  }
}