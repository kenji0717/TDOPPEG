// terminalize.jp

function terminalize(termID,listener) {
  var term = {};
  term.echo = true;
  term.prompt = "$ ";
  term.tDiv = document.getElementById(termID);
  term.tDiv.setAttribute("style","overflow-y:scroll;overflow-x:visible;");
  term.outputArea = document.createElement("pre");
  term.outputArea.setAttribute("class","terminalize_stdout");
  term.tDiv.appendChild(term.outputArea);
  term.outputText = document.createTextNode("");
  term.outputArea.appendChild(term.outputText);
  term.promptText = document.createTextNode(term.prompt);
  term.tDiv.appendChild(term.promptText);
  term.inputLine = document.createElement("input");
  term.inputLine.type = "text";
  term.inputLine.setAttribute("class","terminalize_stdin");
  term.tDiv.appendChild(term.inputLine);

  term.stdOut = "";
  term.inputListener = [listener];

  term.write = function(str) {
    this.stdOut = this.stdOut + str;
    this.outputText.nodeValue = this.stdOut;
    term.tDiv.scrollTop = term.tDiv.scrollHeight;//常に一番下にスクロール
  };

  //タブも入力できるようにする．でも必用ないか．．．
  term.inputLine.addEventListener('keydown', function(e) {
    e = e || window.event; //IE対応？
    if (e.keyCode == 9) {
      if (e.preventDefault) {
        e.preventDefault();
      }
      this.value = this.value + "\t";
      return false;
    }
    return true;
  });

  //エンターキー投下で入力と見做す
  term.inputLine.addEventListener('keypress', function(e) {
    e = e || window.event; //IE対応？
    if (e.keyCode == 13) {
      var line = this.value;
      this.value = '';
      if (term.echo==true) {
        term.write(term.prompt+line+"\n");
      }
      for (var i=0;i<term.inputListener.length;i++) {
        if (term.inputListener[i]) {
          term.inputListener[i](line);
        }
      }
    }
  });

  // tDiv内のクリックで必ずinputLineにフォーカスを持っていく
  term.tDiv.tabIndex = 0;
  term.tDiv.onfocus = function(e) {
    term.inputLine.focus();
  };

  term.clear = function() {
    term.stdOut = "";
    term.outputText.nodeValue = "";
    term.inputLine.value = "";
  };

  term.addInputListener = function(l) {
    term.inputListener.push(l);
  };

  term.removeInputListener= function(l) {
    term.inputListener.splice(term.inputListener.indexOf(l),1);
  };

  term.read = function() {
    return term.stdOut;
  };

  term.echoOn = function() {
    term.echo = true;
  }

  term.echoOff = function() {
    term.echo = false;
  }

  term.setPrompt = function(p) {
    term.prompt = p;
    term.promptText.nodeValue = p;
  }

  return term;
}
