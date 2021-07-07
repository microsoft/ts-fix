class Base {
    foo() {
      console.log("called foo in Base");
    }
  
    bar() {
      console.log("called bar in Base");
    }
  }
  
  class Derived extends Base {
    foo() {
      console.log("called foo in Derived");
      super.foo();
    }
  
    bar() {
      console.log("called bar in Derived");
    }
  }
  