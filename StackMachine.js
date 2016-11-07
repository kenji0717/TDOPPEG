// StackMachine.jp

function StackMachine(printFunction,uiFunction) {
  this.printLine = printFunction; //一行表示するための関数
  this.uiListener = uiFunction; //PRINT命令の出力を受け取ってくれる関数を登録
  this.inputLines = []; //入力行を保存しておくキュー
  this.is; //命令セット(命令の配列)
  this.pp = 0;//プログラムポインタ
  this.maxPP;//プログラムポインタの最大値
  this.waitingForInput = false; //入力待ちであることを示すフラグ
  this.stopRequest = false;//BP命令(ブレークポイント)で停止する時true
  this.labels = {};//ラベル名がキー，プログラムポインタが値
  this.bp = {}; //ブレークポイントの候補．プログラムポインタがキー，行番号が値
  this.abp = {}; //有効化されているブレークポイント．プログラムポインタがキー，行番号が値
  this.stack = []; //スタックマシンのスタック
  this.topActRec = {//グローバルを表す一番外の駆動レコード(Active Record)
    name: "@GLOBAL@", //駆動レコード名
    parent: null, //親駆動レコード名
    access_link: null, //アクセスリンク(静的リンク)
    returnPP: null, //RETする時のジャンプ先
    vars: [] //変数
  };
  this.actRec = this.topActRec; //現在の駆動レコード
  this.lineNumber = 0; //これはコンパイル前の元となる言語の行番号
}

StackMachine.prototype = {

  push : function(value) {
    this.stack.push(value);
  },

  pop : function() {
    return this.stack.pop();
  },

  //変数を定義する
  vDef : function(vName) {
    this.actRec.vars.push([vName,undefined]);
  },

  //変数を開放する
  vRemove : function(vName) {
    var i;
    for (i=this.actRec.vars.length-1;i>=0;i--) {
      if (this.actRec.vars[i][0]===vName) {
        this.actRec.vars = this.actRec.vars.splice(i,1);
        break;
      }
    }
  },

  //変数に値をセットする(静的スコープで処理)
  vSet : function(vName,val) {
    var ar = this.actRec;
    while (ar != null) {
      for (var i=ar.vars.length-1;i>=0;i--) {
        if (ar.vars[i][0]===vName) {
          ar.vars[i][1] = val;
          return;
        }
      }
      ar = ar.access_link;//静的スコープ
    }
    alert("No such variable! "+vName);
  },

  //変数に値をセットする(動的スコープで処理)
  vSet2 : function(vName,val) {
    var ar = this.actRec;
    while (ar != null) {
      for (var i=ar.vars.length-1;i>=0;i--) {
        if (ar.vars[i][0]===vName) {
          ar.vars[i][1] = val;
          return;
        }
      }
      ar = ar.parent;//動的スコープ
    }
    alert("No such variable! "+vName);
  },

  //変数から値を取り出す(静的スコープで処理)
  vGet : function(vName) {
    var ar = this.actRec;
    while (ar != null) {
      for (var i=ar.vars.length-1;i>=0;i--) {
        if (ar.vars[i][0]===vName) {
          return ar.vars[i][1];
        }
      }
      ar = ar.access_link;//静的スコープ
    }
    alert("No such variable! "+vName);
    return undefined;
  },

  //変数から値を取り出す(動的スコープで処理)
  vGet2 : function(vName) {
    var ar = this.actRec;
    while (ar != null) {
      for (var i=ar.vars.length-1;i>=0;i--) {
        if (ar.vars[i][0]===vName) {
          return ar.vars[i][1];
        }
      }
      ar = ar.parent;//動的スコープ
    }
    alert("No such variable! "+vName);
    return undefined;
  },

  //配列の宣言
  arrayDef : function(aName) {
    this.actRec.vars.push([aName,[]]);
  },

  //配列を開放する
  arrayRemove : function(aName) {
    var i;
    for (i=this.actRec.vars.length-1;i>=0;i--) {
      if (this.actRec.vars[i][0]===aName) {
        this.actRec.vars = this.actRec.vars.splice(i,1);
        break;
      }
    }
  },

  //配列に値をセットする(静的スコープで処理)
  arraySet : function(aName,idx,val) {
    var nowActRec = this.actRec;
    while (nowActRec != null) {
      for (var i=newActRec.vars.length-1;i>=0;i--) {
        if (newActRec.vars[i][0]===aName) {
          newActRec.vars[i][1][idx] = val;
          return;
        }
      }
      nowActRec = nowActRec.access_link;//静的スコープ
    }
    alert("No such array! "+aName);
  },

  //配列に値をセットする(動的スコープで処理)
  arraySet2 : function(aName,idx,val) {
    var nowActRec = this.actRec;
    while (nowActRec != null) {
      for (var i=newActRec.vars.length-1;i>=0;i--) {
        if (newActRec.vars[i][0]===aName) {
          newActRec.vars[i][1][idx] = val;
          return;
        }
      }
      nowActRec = nowActRec.parent;//動的スコープ
    }
    alert("No such array! "+aName);
  },

  //配列から値を取り出す(静的スコープで処理)
  arrayGet : function(aName,idx) {
    var nowActRec = this.actRec;
    while (nowActRec != null) {
      for (var i=nowActRec.vars.length-1;i>=0;i--) {
        if (nowActRec.vars[i][0]===aName) {
          return nowActRec.vars[i][1][idx];
        }
      }
      nowActRec = nowActRec.access_link;//静的スコープ
    }
    alert("No such array! "+aName);
    return undefined;
  },

  //配列から値を取り出す(動的スコープで処理)
  arrayGet2 : function(aName,idx) {
    var nowActRec = this.actRec;
    while (nowActRec != null) {
      for (var i=nowActRec.vars.length-1;i>=0;i--) {
        if (nowActRec.vars[i][0]===aName) {
          return nowActRec.vars[i][1][idx];
        }
      }
      nowActRec = nowActRec.parent;//動的スコープ
    }
    alert("No such array! "+aName);
    return undefined;
  },

  //デバッグ用文字列の生成
  debugString : function() {
    var s = "行番号="+lineNumber+"\n";
    s = s + "プログラムポインタ="+pp+"\n";
    s = s + "スタック[";
    for (var i=0;i<this.stack.length;i++) {
      s = s + this.stack[i]+", ";
    }
    s = s + "]\n";
    var vars = {};
    s = s + "駆動レコード[\n";
    var nowActRec = this.actRec;
    while (nowActRec != null) {
      for (var i=0;i<nowActRec.vars.length;i++) {
        s = s + nowActRec.vars[i][0]+"="+nowActRec.vars[i][1]+", ";
      }
      s = s + "\n";
      nowActRec = nowActRec.parent;
    }
    s = s + "]\n";
    return s;
  },

  //ニーモニック？のソースコードを読み込む
  //ラベル，ブレークポイントの処理もする
  loadInstructions : function(prog) {
    this.is = [];
    this.labels = {};
    this.bp = {};
    var lines = prog.split(/\r\n|\r|\n/);
    var progPtr = 0;//コメント行がありうるのでiだけではすまない
    for (var i=0;i<lines.length;i++) {
      lines[i] = lines[i].trim();
      if (lines[i].startsWith("//") || lines[i]==="") {
        continue;
      }

      var idx = lines[i].indexOf("#@LABEL");
      if (idx != -1) {
        var meirei = lines[i].substring(0,idx).trim();
        var label = lines[i].substring(idx).trim();
        lines[i] = meirei;
        var ll = label.split(/\s/);
        if (/^\D/.test(ll[1])) { //ll[1]が数字じゃない時
          this.labels[ll[1]] = progPtr;
          if (ll[2]) {
            this.bp[progPtr] = parseInt(ll[2],10);
          }
        } else {
          this.bp[progPtr] = parseInt(ll[1],10);
        }
      }
      
      //idx = lines[i].indexOf(/\s/);
      idx = lines[i].indexOf(" ");
      if (idx==-1) {
        this.is.push([lines[i].trim()]);
      } else {
        var inst = lines[i].substring(0,idx).trim();
        var op = lines[i].substring(idx).trim();
        this.is.push([inst,op]);
      }

      progPtr++;
    }
  },

  //Stack Machineを初期化する
  init : function(prog) {
    this.inputLines = [];
    this.waitingForInput = false;
    this.pp = 0;
    this.loadInstructions(prog);//this.{is,labels,bp}が初期化される
    this.maxPP = this.is.length;
    this.stopRequest = false;
    /*
    //ジャンプ先のラベルの解析(廃止)
    this.labels = {};
    for (var i=0;i<this.is.length;i++) {
      if (this.is[i][0]==="LABEL") {
        var op = this.is[i][1];
        if (this.labels[op]) {
          alert("There are same LABELs!");
          return;
        }
        this.labels[op] = i;
      }
    }
    */
    this.abp = {};
    this.stack = [];
    this.topActRec.name = "@GLOBAL@";
    this.topActRec.parent = null;
    this.topActRec.access_link = null;
    this.topActRec.returnPP = null;
    this.topActRec.vars = [];
    this.actRec = this.topActRec;
    this.lineNumber = 0;
    console.log("Stack Machine is reseted.");
  },

  //l行目にブレークポイントを設定する．
  //l行目に複数のブレークポイント候補場所が含まれて
  //いる場合には，それら全てに設定する．逆にl行目に
  //ブレークポイント候補場所が1つも無いときは設定でない．
  //設定できたブレークポイントの数を返す．
  setBreakPoint : function(l) {
    var count = 0;
    for (var pp in this.bp) {
      if (this.bp[pp] === l) {
        this.abp[pp] = this.bp[pp];
        count++;
      }
    }
    return count;
  },

  //l行目のブレークポイントを解除する．
  //l行目に複数のブレークポイント候補場所が含まれて
  //いる場合には，それら全てを解除する．逆にl行目に
  //ブレークポイント候補場所が1つも無かったときは何もしない．
  //解除されたブレークポイントの数を返す．
  clearBreakPoint : function(l) {
    var count = false;
    for (var pp in this.bp) {
      if (this.bp[pp] === l) {
        delete this.abp[pp];
        count++;
      }
    }
    return count;
  },

  //全てのブレークポイント候補場所に
  //ブレークポイントを設定する．ブレークポイントが
  //設定できた行の行番号を配列で返す．
  setAllBreakPoints : function() {
    var lines = [];
    for (var pp in this.bp) {
      this.abp[pp] = this.bp[pp];
      lines.push(this.bp[pp]);
    }
    return lines;
  },

  //全てのブレークポイントを解除する．
  //ブレークポイントを解除した行の行番号を配列で返す．
  clearAllBreakPoints : function() {
    var lines = [];
    for (var pp in this.bp) {
      delete this.abp[pp];
      lines.push(this.bp[pp]);
    }
    return lines;
  },

  //Stack Machineを実行
  exec : function() {
    this.stopRequest = false;
    var first = true;//最初の命令はBPでも止めない
    if (this.pp>=this.maxPP)
      return;
    while(this.waitingForInput!=true) {
      if (!first && this.stopRequest==true)
        return;
      if (!first && this.abp[this.pp]!=undefined)
        return;
      this.oneStepExec();
      first = false;
      if (this.pp>=this.maxPP) {
        printLine("----- プログラム終了 -----\n");
        break;
      }
    }
  },

  //標準入力から1行入力が得られた時に呼び出すように
  //して下さい．
  input : function(str) {
    //alert("input: "+str);
    this.inputLines.push(str);
    this.waitingForInput = false;
    this.exec();
  },

  //Stack Machineを1ステップ実行
  oneStepExec : function() {
    var inst = this.is[this.pp][0];
    var op = this.is[this.pp][1];
    this.pp++;//プログラムポインタを1増やして次の命令を指した状態にする

    if (inst==="VAR") {
      this.vDef(op);
    } else if (inst==="FREE") {
      this.vRemove(op);
    } else if (inst==="PUSH") {
      if (op.startsWith('"')) {
        op = op.substring(1,op.length-1);
      } else {
        op = Number(op);
      }
      this.push(op);
    } else if (inst==="DROP") {
      this.pop();
    } else if (inst==="DUP") {
      var op1 = this.pop();
      this.push(op1);
      this.push(op1);
    } else if (inst==="SWAP") {
      var op1 = this.pop();
      var op2 = this.pop();
      this.push(op1);
      this.push(op2);
    } else if (inst==="ADD") {
      var op1 = this.pop();
      var op2 = this.pop();
      var res = op2 + op1;
      this.push(res);
    } else if (inst==="SUB") {
      var op1 = this.pop();
      var op2 = this.pop();
      var res = op2 - op1;
      this.push(res);
    } else if (inst==="MUL") {
      var op1 = this.pop();
      var op2 = this.pop();
      var res = op2 * op1;
      this.push(res);
    } else if (inst==="DIV") {
      var op1 = this.pop();
      var op2 = this.pop();
      var res = op2 / op1;
      this.push(res);
    } else if (inst==="MOD") {
      var op1 = this.pop();
      var op2 = this.pop();
      var res = op2 % op1;
      this.push(res);
    } else if (inst==="INC") {
      var op = this.pop();
      op++;
      this.push(op);
    } else if (inst==="DEC") {
      var op = this.pop();
      op--;
      this.push(op);
    } else if (inst==="LT") {
      var op1 = this.pop();
      var op2 = this.pop();
      var res = op2 < op1 ? -1 : 0;
      this.push(res);
    } else if (inst==="LE") {
      var op1 = this.pop();
      var op2 = this.pop();
      var res = op2 <= op1 ? -1 : 0;
      this.push(res);
    } else if (inst==="EQ") {
      var op1 = this.pop();
      var op2 = this.pop();
      var res = op2 == op1 ? -1 : 0;
      this.push(res);
    } else if (inst==="GE") {
      var op1 = this.pop();
      var op2 = this.pop();
      var res = op2 >= op1 ? -1 : 0;
      this.push(res);
    } else if (inst==="GT") {
      var op1 = this.pop();
      var op2 = this.pop();
      var res = op2 > op1 ? -1 : 0;
      this.push(res);
    } else if (inst==="NEQ") {
      var op1 = this.pop();
      var op2 = this.pop();
      var res = op2 != op1 ? -1 : 0;
      this.push(res);
    } else if (inst==="AND") {
      var op1 = this.pop();
      var op2 = this.pop();
      var res = op1 & op2;
      this.push(res);
    } else if (inst==="OR") {
      var op1 = this.pop();
      var op2 = this.pop();
      var res = op1 | op2;
      this.push(res);
    } else if (inst==="NOT") {
      var op1 = this.pop();
      var res = ~ op1;
      this.push(res);
    } else if (inst==="XOR") {
      var op1 = this.pop();
      var op2 = this.pop();
      var res = op1 ^ op2;
      this.push(res);
    } else if (inst==="SR") {
      var op1 = this.pop();
      var op2 = this.pop();
      var res = op1 >> op2;
      this.push(res);
    } else if (inst==="SL") {
      var op1 = this.pop();
      var op2 = this.pop();
      var res = op1 << op2;
      this.push(res);
    } else if (inst==="SET") {//レキシカルスコープ
      var op1 = this.pop();
      this.vSet(op,op1);
    } else if (inst==="GET") {//レキシカルスコープ
      var val = this.vGet(op);
      this.push(val);
    } else if (inst==="SET2") {//動的スコープ
      var op1 = this.pop();
      this.vSet2(op,op1);
    } else if (inst==="GET2") {//動的スコープ
      var val = this.vGet2(op);
      this.push(val);
//    } else if (inst==="LABEL") {//廃止
//      //何もしない
    } else if (inst==="JUMP") {
      this.pp = this.labels[op];
    } else if (inst==="IFJUMP") {
      var op1 = this.pop();
      if (op1 != 0) {
        this.pp = this.labels[op];
      }
    } else if (inst==="PRINT") {
      var op = this.pop();
      if (typeof op == "string") {
        op = op.replace("\\n","\n");//これなんか良い方法ない？？？
        op = op.replace("\\t","\t");//これなんか良い方法ない？？？
        op = op.replace("\\b","\b");//これなんか良い方法ない？？？
        op = op.replace("\\f","\f");//これなんか良い方法ない？？？
        op = op.replace("\\r","\r");//これなんか良い方法ない？？？
        //op = op.replace("\\u....","\u????");//これなんか良い方法ない？？？
      }
      this.printLine(op);
      //printLine(op);//とりあえずむりやり改行させてる
    } else if (inst==="SCANI") {
      var l = this.inputLines.pop();
      this.push(parseInt(l));
    } else if (inst==="SCANF") {
      var l = this.inputLines.pop();
      this.push(parseFloat(l));
    } else if (inst==="SCANS") {
      var l = this.inputLines.pop();
      this.push(l);
    } else if (inst==="SCANC") {
      var l = this.inputLines.pop();
      this.push(l.substring(0,1));
    } else if (inst==="BP") {
      this.stopRequest = true;
    } else if (inst==="INPUT_WAIT") {
      if (this.inputLines.length<=0) {
        this.waitingForInput = true;
      }
    } else if (inst==="NOP") {
      // NOP
//    } else if (inst==="LINE") {//廃止
//      this.lineNumber = parseInt(op);
    } else if (inst==="ARRAY") {
      this.arrayDef(op);
    } else if (inst==="ARRAY_SET") {
      var op1 = this.pop();
      var op2 = this.pop();
      this.arraySet(op,op2,op1);
    } else if (inst==="ARRAY_GET") {
      var op1 = this.pop();
      var res = this.arrayGet(op,op1);
      this.push(res);
    } else if (inst==="FREE_ARRAY") {
      this.arrayRemove(op);
    } else if (inst==="NEW_AR") {
      var op1 = this.pop();
      var op2 = this.pop();
      var ar = this.actRec;
      var al = null;
      while (ar != null) {
        if (op1 === ar.name) {
          al = ar;
          break;
        }
        ar = ar.parent;
      }
      var nar = {
        name: op2,
        parent: this.actRec,
        access_link: al,
        returnPP: null,
        vars: []
      };
      this.actRec = nar;
    } else if (inst==="POP_AR") {
      if (this.actRec.parent == null) {
        alert("POP_AR: Can not pop!");
      } else {
        this.actRec = this.actRec.parent;
      }
    } else if (inst==="CALL") {
      var op1 = this.pop();
      var op2 = this.pop();
      var ar = this.actRec;
      var al = null;
      while (ar != null) {
        if (op1 === ar.name) {
          al = ar;
          break;
        }
        ar = ar.parent;
      }
      var nar = {
        name: op2,
        parent: this.actRec,
        access_link: al,
        returnPP: this.pp,
        vars: []
      };
      this.actRec = nar;
      this.pp = this.labels[op];
    } else if (inst==="RET") {
      if (this.actRec.parent == null) {
        alert("RET: Can not ret!");
      } else {
        var returnPP = this.actRec.returnPP;
        this.actRec = this.actRec.parent;
        this.pp = returnPP;
      }
    } else {
      alert("Unrecognised instruction! "+inst+" "+op);
    }

    if (this.abp[this.pp]) {//次の命令にブレークポイントが設定されてたら
      this.lineNumber = this.abp[this.pp];
      this.stopRequest = true;
    }
    if (this.stopRequest === true) {//BP命令でもここで止まる
      //UIを変更するのに必用な情報を送る．
      if (this.uiListener) {
        inst = this.is[this.pp][0]; //実行前の(次の)命令を送る
        op = this.is[this.pp][1];   //実行前の(次の)命令を送る

        var uiInfo = {};
        uiInfo.lineNumber = this.lineNumber;
        uiInfo.programPointer = this.pp;
        uiInfo.stack = this.stack;
        uiInfo.actRec = this.actRec;
        uiInfo.instruction = inst+" "+(op?op:"");
        this.uiListener(uiInfo);
      }
    }
    //デバッグ情報をコンソールに表示
    //console.log(debugString());
  }
};
