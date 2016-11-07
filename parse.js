// parse.js
// Parser for Simplified JavaScript written in Simplified JavaScript
// From Top Down Operator Precedence
// http://javascript.crockford.com/tdop/index.html
// Douglas Crockford
// 2010-06-26

var make_parse = function () {
    var scope;
    var symbol_table = {};
    var token;
    var tokens;
    var token_nr;
    var label_count = 1;
    var continue_label;//continueを実現するためのラベル(もっと良い方法ない？)
    var break_label;//breakを実現するためのラベル(もっと良い方法ない？)

    var itself = function () {
        return this;
    };

    var original_scope = {
        define: function (n) {
            var t = this.def[n.value];
            if (typeof t === "object") {
                n.error(t.reserved ? "Already reserved." : "Already defined.");
            }
            this.def[n.value] = n;
            n.reserved = false;
            n.nud      = itself;
            n.led      = null;
            n.std      = null;
            n.lbp      = 0;
            n.scope    = scope;
            return n;
        },
        find: function (n) {
            var e = this, o;
            while (true) {
                o = e.def[n];
                if (o && typeof o !== 'function') {
                    return e.def[n];
                }
                e = e.parent;
                if (!e) {
                    o = symbol_table[n];
                    return o && typeof o !== 'function' ? o : symbol_table["(name)"];
                }
            }
        },
        pop: function () {
            scope = this.parent;
        },
        reserve: function (n) {
            if (n.arity !== "name" || n.reserved) {
                return;
            }
            var t = this.def[n.value];
            if (t) {
                if (t.reserved) {
                    return;
                }
                if (t.arity === "name") {
                    n.error("Already defined.");
                }
            }
            this.def[n.value] = n;
            n.reserved = true;
        }
    };

    var new_scope = function () {
        var s = scope;
        scope = Object.create(original_scope);
        scope.def = {};
        scope.parent = s;
        return scope;
    };

    var advance = function (id) {
        var a, o, t, v;
        if (id && token.id !== id) {
            token.error("Expected '" + id + "'.");
        }
        if (token_nr >= tokens.length) {
            token = symbol_table["(end)"];
            return;
        }
        t = tokens[token_nr];
        token_nr += 1;
        v = t.value;
        a = t.type;
        if (a === "name") {
            o = scope.find(v);
        } else if (a === "operator") {
            o = symbol_table[v];
            if (!o) {
                t.error("Unknown operator.");
            }
        } else if (a === "string" || a ===  "number") {
            o = symbol_table["(literal)"];
            a = "literal";
        } else {
            t.error("Unexpected token.");
        }
        token = Object.create(o);
        token.from  = t.from;
        token.to    = t.to;
        token.value = v;
        token.arity = a;
        token.row  = t.row;
        token.col  = t.col;
        return token;
    };

    var expression = function (rbp) {
        var left;
        var t = token;
        advance();
        left = t.nud();
        while (rbp < token.lbp) {
            t = token;
            advance();
            left = t.led(left);
        }
        return left;
    };

    var statement = function () {
        var n = token, v;

        if (n.std) {
            advance();
            scope.reserve(n);
            return n.std();
        }
        v = expression(0);
        if (!v.assignment && v.id !== "(" //ここの"("が何かわかってないGAHA
            && v.id !== "++" && v.id !== "--") {
            v.error("Bad expression statement.");
        }
        advance(";");
        //代入文だったり++するだけの文はスタックに積まれた
        //計算結果が不要なので，ここでフラグを付けといて
        //その不要な計算結果を消すようなcodeを生成するようにする
        //と思ったけど，ここだけじゃ根本的な対処にならないことに
        //気がついたので，とりやめることにする
        //if (v.assignment || v.id === "++" || v.id ==="--") {
        //    v.pop_stack = true;
        //}
        return v;
    };

    var statements = function () {
        var a = [], s;
        while (true) {
            if (token.id === "}" || token.id === "(end)") {
                break;
            }
            s = statement();
            if (s) {
                a.push(s);
            }
        }
        //return a.length === 0 ? null : a.length === 1 ? a[0] : a;
        return a.length === 0 ? null : a;
    };

    var block = function () {
        var t = token;
        advance("{");
        return t.std();
    };

    var original_symbol = {
        nud: function () {
            this.error("Undefined.");
        },
        led: function (left) {
            this.error("Missing operator.");
        },
        code: function () {
            this.error("override code function of this symbol!");
        }
    };

    var symbol = function (id, bp,code) {
        var s = symbol_table[id];
        bp = bp || 0;
        if (s) {
            if (bp >= s.lbp) {
                s.lbp = bp;
            }
        } else {
            s = Object.create(original_symbol);
            s.id = s.value = id;
            s.lbp = bp;
            symbol_table[id] = s;
        }
        if (code != null) {
            s.code = code;
        }
        return s;
    };

    var constant = function (s, v) {
        var x = symbol(s);
        x.nud = function () {
            scope.reserve(this);
            this.value = symbol_table[this.id].value;
            this.arity = "literal";
            return this;
        };
        x.value = v;
        x.code = function () {
            if (typeof(this.value) === 'string') {
                return 'PUSH "' + this.value + '"';
            } else {
                return 'PUSH ' + this.value;
            }
        }
        return x;
    };

    var infix = function (id, bp, led, code) {
        var s = symbol(id, bp);
        s.led = led || function (left) {
            this.first = left;
            this.second = expression(bp);
            this.arity = "binary";
            return this;
        };
        s.code = code;
        return s;
    };

    var infixr = function (id, bp, led, code) {
        var s = symbol(id, bp);
        s.led = led || function (left) {
            this.first = left;
            this.second = expression(bp - 1);
            this.arity = "binary";
            return this;
        };
        s.code = code;
        return s;
    };

    var assignment = function (id,code) {
        return infixr(id, 10, function (left) {
            if (left.id !== "." && left.id !== "[" && left.arity !== "name") {
                left.error("Bad lvalue.");
            }
            this.first = left;
            this.second = expression(9);
            this.assignment = true;
            this.arity = "binary";
            return this;
        },code);
    };

    var prefix = function (id, nud, code) {
        var s = symbol(id);
        s.nud = nud || function () {
            scope.reserve(this);
            this.first = expression(70);
            this.arity = "unary";
            return this;
        };
        s.code = code;
        return s;
    };

    var stmt = function (s, f, code) {
        var x = symbol(s);
        x.std = f;
        x.code = code;
        return x;
    };

    symbol("(end)");
    symbol("(name)",null,function() {
        return "GET " + this.value + "\n";
    });
    symbol(":");
    symbol(";");
    symbol(")");
    symbol("]");
    symbol("}");
    symbol(",");
    symbol("else");

    //constant("true", true);
    //constant("false", false);
    //constant("null", null);
    //constant("pi", 3.141592653589793);
    //constant("Object", {});
    //constant("Array", []);

    symbol("(literal)").nud = itself;
    symbol("(literal)").code = function() {
        if (typeof(this.value)==='string') {
            return 'PUSH "' + this.value + '"' + "\n";
        } else {
            return 'PUSH ' + this.value + "\n";
        }
    };

    //symbol("this").nud = function () {
    //    scope.reserve(this);
    //    this.arity = "this";
    //    return this;
    //};

    assignment("=",function() {
        var s = "";
        s = s + this.second.code();
        s = s + "DUP\n";
        s = s + 'SET ' + this.first.value + "\n";
        return s;
    });
    assignment("+=",function() {
        var s = "";
        s = s + 'GET ' + this.first.value + "\n";
        s = s + this.second.code();
        s = s + "ADD\n";
        s = s + "DUP\n";
        s = s + 'SET ' + this.first.value + "\n";
        return s;
    });
    assignment("-=",function() {
        var s = "";
        s = s + 'GET ' + this.first.value + "\n";
        s = s + this.second.code();
        s = s + "SUB\n";
        s = s + "DUP\n";
        s = s + 'SET ' + this.first.value + "\n";
        return s;
    });
    assignment("*=",function() {
        var s = "";
        s = s + 'GET ' + this.first.value + "\n";
        s = s + this.second.code();
        s = s + "MUL\n";
        s = s + "DUP\n";
        s = s + 'SET ' + this.first.value + "\n";
        return s;
    });
    assignment("/=",function() {
        var s = "";
        s = s + 'GET ' + this.first.value + "\n";
        s = s + this.second.code();
        s = s + "DIV\n";
        s = s + "DUP\n";
        s = s + 'SET ' + this.first.value + "\n";
        return s;
    });
    assignment("%=",function() {
        var s = "";
        s = s + 'GET ' + this.first.value + "\n";
        s = s + this.second.code();
        s = s + "MOD\n";
        s = s + "DUP\n";
        s = s + 'SET ' + this.first.value + "\n";
        return s;
    });
    assignment("&=",function() {
        var s = "";
        s = s + 'GET ' + this.first.value + "\n";
        s = s + this.second.code();
        s = s + "MOD\n";
        s = s + "DUP\n";
        s = s + 'SET ' + this.first.value + "\n";
        return s;
    });

    infix("?", 20, function (left) {
        this.first = left;
        this.second = expression(0);
        advance(":");
        this.third = expression(0);
        this.arity = "ternary";
        return this;
    },function() {
        var s = "";
        s = s + this.first.code();
        s = s + "PUSH 0\n";//下と2つ合せて
        s = s + "EQ\n";//論理否定
        s = s + "IFJUMP " + label_count + "\n";
        s = s + this.second.code();
        s = s + "JUMP " + (label_count + 1) + "\n";
        s = s + "LABEL " + label_count + "\n";
        label_count++;
        s = s + this.third.code();
        s = s + "LABEL " + label_count + "\n";
        label_count++;
        return s;
    });

    //++演算子のcodeが前置か後置かで微妙に違ってて共通の
    //関数にしないと上手くいけなさそうなのでここで宣言
    var inc_pre_post_code = function() {
        var s = "";
        if (this.first.arity === "name") {
            s = s + "GET " + this.first.value + "\n";
            if (this.prepost === "pre") s = s + "INC\n";
            s = s + "DUP\n"
            if (this.prepost === "post") s = s + "INC\n"
            s = s + "SET " + this.first.value + "\n";
        } else if (this.first.id === "[") {
            s = s + "配列要素の++はまたそのうち\n";
        } else if (this.first.id === ".") {
            s = s + "構造体の++は未対応";
        }
        return s;
    }
    //--演算子のcodeが前置か後置かで微妙に違ってて共通の
    //関数にしないと上手くいけなさそうなのでここで宣言
    var dec_pre_post_code = function() {
        var s = "";
        if (this.first.arity === "name") {
            s = s + "GET " + this.first.value + "\n";
            if (this.prepost === "pre") s = s + "DEC\n";
            s = s + "DUP\n"
            if (this.prepost === "post") s = s + "DEC\n"
            s = s + "SET " + this.first.value + "\n";
        } else if (this.first.id === "[") {
            s = s + "配列要素の++はまたそのうち\n";
        } else if (this.first.id === ".") {
            s = s + "構造体の++は未対応";
        }
        return s;
    }

    //後置演算子の++一応左結合でしょ？
    //bpは掛け算，割り算より上でprefixの70より低く
    //ということで65
    infix("++",65,function (left) {
        if (left.id !== "." && left.id !== "[" && left.arity !== "name") {//assignmentのまね
            left.error("Bad lvalue.");
        }
        this.first = left;
        this.arity = "unary";//でしょ？
        this.prepost = "post";//これが必用！
        return this;
    },inc_pre_post_code);
    infix("--",65,function (left) {
        if (left.id !== "." && left.id !== "[" && left.arity !== "name") {//assignmentのまね
            left.error("Bad lvalue.");
        }
        this.first = left;
        this.arity = "unary";//でしょ？
        return this;
    },dec_pre_post_code);

    infixr("&&", 30,null,function() {
        var s = "";//へたくそかもGAHA
        s = s + this.first.code();
        s = s + "PUSH 0\n";
        s = s + "NEQ\n";
        s = s + this.second.code();
        s = s + "PUSH 0\n";
        s = s + "NEQ\n";
        s = s + "AND\n";
        return s;
    });
    infixr("||", 30,null,function() {
        var s = this.first.code();
        s = s + this.second.code();
        s = s + "OR\n";
        s = s + "PUSH 0\n";
        s = s + "NEQ\n";
        return s;
    });

    infixr("==", 40,null,function() {
        var s = this.first.code();
        s = s + this.second.code();
        s = s + "EQ\n";
        return s;
    });
    infixr("!==", 40,null,function() {
        var s = this.first.code();
        s = s + this.second.code();
        s = s + "NEQ\n";
        return s;
    });
    infixr("<", 40,null,function() {
        var s = this.first.code();
        s = s + this.second.code();
        s = s + "LT\n";
        return s;
    });
    infixr("<=", 40,null,function() {
        var s = this.first.code();
        s = s + this.second.code();
        s = s + "LE\n";
        return s;
    });
    infixr(">", 40,null,function() {
        var s = this.first.code();
        s = s + this.second.code();
        s = s + "GT\n";
        return s;
    });
    infixr(">=", 40,null,function() {
        var s = this.first.code();
        s = s + this.second.code();
        s = s + "GE\n";
        return s;
    });

    infix("+", 50,null,function() {
        var s = this.first.code();
        s = s + this.second.code();
        s = s + "ADD\n";
        return s;
    });
    infix("-", 50,null,function() {
        var s = this.first.code();
        s = s + this.second.code();
        s = s + "SUB\n";
        return s;
    });

    infix("*", 60,null,function() {
        var s = this.first.code();
        s = s + this.second.code();
        s = s + "MUL\n";
        return s;
    });
    infix("/", 60,null,function() {
        var s = this.first.code();
        s = s + this.second.code();
        s = s + "DIV\n";
        return s;
    });
    infix("%", 60,null,function() {
        var s = this.first.code();
        s = s + this.second.code();
        s = s + "MOD\n";
        return s;
    });

    infix(".", 80, function (left) {
        this.first = left;
        if (token.arity !== "name") {
            token.error("Expected a property name.");
        }
        token.arity = "literal";
        this.second = token;
        this.arity = "binary";
        advance();
        return this;
    });

    infix("[", 80, function (left) {
        this.first = left;
        this.second = expression(0);
        this.arity = "binary";
        advance("]");
        return this;
    });

    infix("(", 80, function (left) {
        var a = [];
        if (left.id === "." || left.id === "[") {
            this.arity = "ternary";
            this.first = left.first;
            this.second = left.second;
            this.third = a;
        } else {
            this.arity = "binary";
            this.first = left;
            this.second = a;
            if ((left.arity !== "unary" || left.id !== "function") &&
                    left.arity !== "name" && left.id !== "(" &&
                    left.id !== "&&" && left.id !== "||" && left.id !== "?") {
                left.error("Expected a variable name.");
            }
        }
        if (token.id !== ")") {
            while (true) {
                a.push(expression(0));
                if (token.id !== ",") {
                    break;
                }
                advance(",");
            }
        }
        advance(")");
        return this;
    });

    prefix("++",function() {
        scope.reserve(this);//prefixのデフォルトのnudのまね
        this.first = expression(70);
        if (this.first.id !== "." && this.first.id !== "[" && this.first.arity !== "name") {//assignmentのまね
            this.first.error("Bad lvalue.");
        }
        this.arity = "unary";
        this.prepost = "pre";//これが必用！
        return this;
    },inc_pre_post_code);
    prefix("--",function() {
        scope.reserve(this);//prefixのデフォルトのnudのまね
        this.first = expression(70);
        if (this.first.id !== "." && this.first.id !== "[" && this.first.arity !== "name") {//assignmentのまね
            this.first.error("Bad lvalue.");
        }
        this.arity = "unary";
        this.prepost = "pre";//これが必用！
        return this;
    },dec_pre_post_code);

    prefix("!",null,function() {
        var s = this.first.code();
        s = s + "PUSH 0\n";
        s = s + "NEQ\n";
        return s;
    });
    prefix("-",null,function() {
        var s = this.first.code();
        s = s + "PUSH -1\n";
        s = s + "MUL\n";
        return s;
    });
    //prefix("typeof");

    prefix("(", function () {
        var e = expression(0);
        advance(")");
        return e;
    },function() {
        var s = "ここが呼ばれることは無いはず\n";
        return s;
    });

/*
    prefix("function", function () {
        var a = [];
        new_scope();
        if (token.arity === "name") {
            scope.define(token);
            this.name = token.value;
            advance();
        }
        advance("(");
        if (token.id !== ")") {
            while (true) {
                if (token.arity !== "name") {
                    token.error("Expected a parameter name.");
                }
                scope.define(token);
                a.push(token);
                advance();
                if (token.id !== ",") {
                    break;
                }
                advance(",");
            }
        }
        this.first = a;
        advance(")");
        advance("{");
        this.second = statements();
        advance("}");
        this.arity = "function";
        scope.pop();
        return this;
    });

    prefix("[", function () {
        var a = [];
        if (token.id !== "]") {
            while (true) {
                a.push(expression(0));
                if (token.id !== ",") {
                    break;
                }
                advance(",");
            }
        }
        advance("]");
        this.first = a;
        this.arity = "unary";
        return this;
    });

    prefix("{", function () {
        var a = [], n, v;
        if (token.id !== "}") {
            while (true) {
                n = token;
                if (n.arity !== "name" && n.arity !== "literal") {
                    token.error("Bad property name.");
                }
                advance();
                advance(":");
                v = expression(0);
                v.key = n.value;
                a.push(v);
                if (token.id !== ",") {
                    break;
                }
                advance(",");
            }
        }
        advance("}");
        this.first = a;
        this.arity = "unary";
        return this;
    });
*/

    stmt("{", function () {
        new_scope();
        this.first = statements();
        advance("}");
        scope.pop();
        return this;
    },function () {
        var i;
        var s = "";
        for (i=0;i<this.first.length;i++) {
            s = s + this.first[i].code();
        }
        return s;
    });

    stmt("int", function () {
        this.a = [];
        var n, t;
        while (true) {
            n = token;
            if (n.arity !== "name") {
                n.error("Expected a new variable name.");
            }
            scope.define(n);
            advance();
            if (token.id === "=") {
                t = token;
                advance("=");
                t.first = n;
                t.second = expression(0);
                t.arity = "binary";
                this.a.push(t);
            } else {
                t = token;
                t.first = n;
                t.second = null;
                t.arity = "define_int";
                this.a.push(t);
            }
            if (token.id !== ",") {
                break;
            }
            advance(",");
        }
        advance(";");
        //return a.length === 0 ? null : a.length === 1 ? a[0] : a;
        return this;
    },function () {
        var s = "";
        for (var i=0;i<this.a.length;i++) {
            s = s + 'VAR ' + this.a[i].first.value + "\n";
            if (this.a[i].arity === "binary") {
              s = s + this.a[i].second.code();
              s = s + "SET " + this.a[i].first.value + "\n";
            }
        }
        return s;
    });

    stmt("if", function () {
        advance("(");
        this.first = expression(0);
        advance(")");
        if (token.id === "{") {
            this.second = block();
        } else {
            this.second = statement();
        }
        if (token.id === "else") {
            scope.reserve(token);
            advance("else");
            if (token.id === "if") {
                this.third = statement();
            } else {
                if (token.id === "{") {
                    this.third = block();
                } else {
                    this.third = statement();
                }
            }
        } else {
            this.third = null;
        }
        this.arity = "statement";
        return this;
    },function() {
        var s = "";
        var label_count_tmp = label_count;
        if (this.third == null) {
            label_count += 1;
s = s + "LINE " + this.row + "\n";
s = s + "BP\n";
            s = s + this.first.code();
            s = s + "PUSH 0\n";//下と2つ合せて
            s = s + "EQ\n";//論理否定
            s = s + "IFJUMP " + label_count_tmp + "\n";
            s = s + this.second.code();
            s = s + "LABEL " + label_count_tmp + "\n";
        } else {
            label_count += 2;
            s = s + this.first.code();
s = s + "LINE " + this.row + "\n";
s = s + "BP\n";
            s = s + "PUSH 0\n";//下と2つ合せて
            s = s + "EQ\n";//論理否定
            s = s + "IFJUMP " + label_count_tmp + "\n";
            s = s + this.second.code();
            s = s + "JUMP " + (label_count_tmp + 1) + "\n";
            s = s + "LABEL " + label_count_tmp + "\n";
if (this.third.id!=="if") {
s = s + "LINE " + this.third.row + "\n";
s = s + "BP\n"; }
            s = s + this.third.code();
            s = s + "LABEL " + (label_count_tmp + 1) + "\n";
        }
        return s;
    });

    stmt("switch", function() {
        advance("(");
        this.first = expression(0);
        advance(")");
        if (token.id === "{") {
            this.second = block();
        } else {//ここに来るのは超変な場合だけどありみたい
            this.second = statement();
        }
        return this;
    },function() {
        var statements;
        if (this.second.id === "{") {
            statements = this.second.first;
        } else {
            statements = [this.second];
        }
        var cases = [];
        var theDefault = null;
        for (var i=0;i<statements.length;i++) {
            var st = statements[i];
            if (st.id === "case") {
                st.label_num = label_count;
                label_count += 1;
                cases.push(st);
            } else if (st.id === "default") {
                //本当はdefaultの重複チェックしないと．．．
                st.label_num = label_count;
                label_count += 1;
                theDefault = st;
            }
        }
        break_label = label_count;
        label_count += 1;
        var s = "";
        s = s + this.first.code();
        for (var i=0;i<cases.length-1;i++) {
            s = s + "DUP\n";
        }
        for (var i=0;i<cases.length;i++) {
            s = s + cases[i].first.code();
            s = s + "EQ\n";
            s = s + "IFJUMP " + cases[i].label_num + "\n";
        }
        if (theDefault != null) {
            s = s + "JUMP " + theDefault.label_num + "\n";
        }
        s = s + "JUMP " + break_label + "\n";
        s = s + this.second.code();
        s = s + "LABEL " + break_label + "\n";
        return s;
    });

    //gccのswitchで実験したら「case ?: 単文;」を単文扱いできるみたい
    stmt("case", function() {
        this.first = expression(0); //本当は整数の定数かのチェックが必用
        advance(":");
        this.second = statement();
        return this;
    },function() {
        //ここが実行される前に"witch"のシンボルのcode関数で
        //this.label_numに適切なラベル番号が設定されているはず．
        var s = "";
        s = s + "LABEL " + this.label_num + "\n";
        s = s + this.second.code();
        return s;
    });

    //gccのswitchで実験したら「case ?: 単文;」を単文扱いできるみたい
    stmt("default", function() {
        advance(":");
        this.first = statement();
        return this;
    },function() {
        //ここが実行される前に"witch"のシンボルのcode関数で
        //this.label_numに適切なラベル番号が設定されているはず．
        var s = "";
        s = s + "LABEL " + this.label_num + "\n";
        s = s + this.first.code();
        return s;
    });

    stmt("return", function () {
        if (token.id !== ";") {
            this.first = expression(0);
        }
        advance(";");
        if (token.id !== "}") {
            token.error("Unreachable statement.");
        }
        this.arity = "statement";
        return this;
    });

    stmt("break", function () {
        advance(";");
        //if (token.id !== "}") {//switch文の中のbreakがあるからチェックしないことにした
        //    token.error("Unreachable statement.");
        //}
        this.arity = "statement";
        return this;
    },function() {
        var s = "";
        s = s + "JUMP " + break_label + "\n";
        return s;
    });

    stmt("continue", function () {
        advance(";");
        this.arity = "statement";
        return this;
    },function() {
        var s = "";
        s = s + "JUMP " + continue_label + "\n";
        return s;
    });

    stmt("while", function () {
        advance("(");
        this.first = expression(0);
        advance(")");
        if (token.id === "{") {
            this.second = block();
        } else {
            this.second = statement();
        }
        this.arity = "statement";
        return this;
    },function() {
        var s = "";
        var label_count_tmp = label_count;
        label_count += 2;
        s = s + "LABEL " + label_count_tmp + "\n";
        continue_label = label_count_tmp;
        break_label = (label_count_tmp + 1);//この時点で設定必用
s = s + "LINE " + this.row + "\n";
s = s + "BP\n";
        s = s + this.first.code();
        s = s + "PUSH 0\n";//下と2つ合せて
        s = s + "EQ\n";//論理否定
        s = s + "IFJUMP " + (label_count_tmp + 1) + "\n";
        s = s + this.second.code();
        s = s + "JUMP " + label_count_tmp + "\n";
        s = s + "LABEL " + (label_count_tmp + 1) + "\n";
        return s;
    });

    stmt("printf", function () {
        advance("(");
        this.first = expression(0);
        this.second = [];
        if (token.id !== ")") {
            while (true) {
                advance(",");
                this.second.push(expression(0));
                if (token.id !== ",") {
                    break;
                }
            }
        }
        advance(")");
        advance(";");
        this.arity = "statement";
        return this;
    },function() {
        var s = "";
s = s + "LINE " + this.row + "\n";
s = s + "BP\n";
        s = s + this.first.code();
        s = s + "PRINT\n";
        for (var i=0;i<this.second.length;i++) {
            s = s + this.second[i].code();
            s = s + "PRINT\n";
        }
        return s;
    });

    stmt("scanf", function () {
        advance("(");
        this.first = expression(0);
        advance(",");
        advance("&");
        this.second = expression(0);
        advance(")");
        advance(";");
        this.arity = "statement";
        return this;
    },function() {
        var s = "";
s = s + "LINE " + this.row + "\n";
//s = s + "BP\n";
        if (this.first.value === "%d") {
            s = s + "INPUT_WAIT\n";
            s = s + "SCANI\n";
        } else if (this.first.value === "%f") {
            s = s + "INPUT_WAIT\n";
            s = s + "SCANF\n";
        } else if (this.first.value === "%s") {
            s = s + "INPUT_WAIT\n";
            s = s + "SCANS\n";
        } else if (this.first.value === "%c") {
            s = s + "INPUT_WAIT\n";
            s = s + "SCANC\n";
        } else {
            s = s + "INPUT_WAIT\n";
            s = s + "SCAN???\n";
        }
        s = s + "SET " + this.second.value + "\n";
        return s;
    });

    stmt("for", function () {
        new_scope();
        advance("(");
        this.first = expression(0);
        advance(";");
        this.second = expression(0);
        advance(";");
        this.third = expression(0);
        advance(")");
        if (token.id === "{") {
            advance("{");
            this.fourth = statements();
            advance("}");
            this.oneStatement = false;
        } else {
            this.fourth = statement();
            this.oneStatement = true;
        }
        this.arity = "statement";
        scope.pop();
        return this;
    },function() {
        var i;
        var s = "";
        var label_count_tmp = label_count;
        label_count += 3;
        s = s + this.first.code();
        s = s + "LABEL " + label_count_tmp + "\n";
        continue_label = (label_count_tmp + 1);
        break_label = (label_count_tmp + 2);//この時点で設定必用
s = s + "LINE " + this.row + "\n";
s = s + "BP\n";
        s = s + this.second.code();
        s = s + "PUSH 0\n";//下と2つ合せて
        s = s + "EQ\n";//論理否定
        s = s + "IFJUMP " + (label_count_tmp + 2) + "\n";
        if (this.oneStatement == true) {
            s = s + this.fourth.code();
        } else {
            for (i = 0;i<this.fourth.length;i++) {
                s = s + this.fourth[i].code();
            }
        }
        s = s + "LABEL " + (label_count_tmp + 1) + "\n";
        s = s + this.third.code();
        s = s + "JUMP " + label_count_tmp + "\n";
        s = s + "LABEL " + (label_count_tmp + 2) + "\n";
        return s;
    });

    stmt("do", function () {
        if (token.id === "{") {
            this.first = block();
        } else {
            this.first = statement();
        }
        advance("while");
        this.second = expression(0);
        advance(";");
        this.arity = "statement";
        return this;
    },function() {
        var s = "";
        var label_count_tmp = label_count;
        label_count += 2;
        s = s + "LABEL " + label_count_tmp + "\n";
        continue_label = label_count_tmp;
        break_label = (label_count_tmp + 1);//この時点で設定必用
s = s + "LINE " + this.row + "\n";
s = s + "BP\n";
        s = s + this.first.code();
        s = s + this.second.code();
        s = s + "IFJUMP " + label_count_tmp + "\n";
        s = s + "LABEL " + (label_count_tmp + 1) + "\n";
        return s;
    });

    return function (source) {
        tokens = source.tokens('=<>!+-*&|/%^', '=<>&|+-');
        token_nr = 0;
        new_scope();
        advance();
        var s = statements();
        advance("(end)");
        scope.pop();
        return s;
    };
};
