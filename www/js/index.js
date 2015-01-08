var CREATE = "CREATE TABLE history (id INTEGER PRIMARY KEY AUTOINCREMENT, name VARCHAR, cost INTEGER, date BIGINT);";

var incomes, expenses;
var db;
var actionId = -1, balance = 0, lastId;
var dialog, menu;
var actions = [];


var app = {

    initialize: function() {
        this.bindEvents();

    },

    bindEvents: function() {
        document.addEventListener('deviceready', this.onDeviceReady, false);
    },

    onDeviceReady: function() {
        incomes = document.getElementById('incomes');
        expenses = document.getElementById('expenses');
        dialog = document.getElementById('dialog');
        menu = document.getElementById('menu');

        var dialogChild = dialog.getElementsByTagName('div')[1];
        dialogChild.onclick = function(e) {
            if(e.target == dialogChild)
                hideDialog()
        } ;
        var menuChild = menu.getElementsByTagName('div')[1];
        menuChild.onclick = function(e) {
            if(e.target == menuChild)
                hideMenu();
        } ;
        document.getElementById('add').onclick = onAddAction;
        document.getElementById('ok').onclick = onDialogApply;
        document.getElementById('cancel').onclick = hideDialog;

        var groups = document.getElementsByClassName('group');
        groups[0].onclick = function() {incomes.style.display = incomes.style.display == 'none' ? 'block' : 'none'};
        groups[1].onclick = function() {expenses.style.display = expenses.style.display == 'none' ? 'block' : 'none'};

        db = openDatabase("LifeBudget", "1.0", "Life Budget", 200000);

        db.transaction(function(tx) {
            tx.executeSql("CREATE TABLE actions (id INTEGER, name VARCHAR, cost INTEGER); ", [], function(tx, res) {
                tx.executeSql("INSERT INTO actions VALUES(0, 'Start bonus', 20);");
            }, function onError(tx, e) {});
            tx.executeSql(CREATE, [], function(tx, res) {}, function onError(tx, e) {});
            tx.executeSql("SELECT * FROM actions;", [], function(tx, res) {
                var rows = res.rows;
                for (var i = 0, item = null; i < rows.length; i++) {
                    item = rows.item(i);
                    actions[item.id] = {name: item.name, cost: item.cost};
                    if(item.id > actionId) actionId = item.id;
                    var view = getActionView(item.id, item.name, item.cost);
                    if(item.cost < 0) {
                        expenses.appendChild(view);
                    } else {
                        incomes.appendChild(view);
                    }
                }
                actionId++;
            });
            tx.executeSql("SELECT sum(cost) as s FROM history;", [], function(tx, res) {
                console.log(res.rows.item(0).s);
                updateBalance(res.rows.item(0).s);
            }, function onError(tx, e) {console.log(e);});
        });
    }
};

var timeout;
function getActionView(id, name, cost) {
    var view = document.createElement('div');
    view.className = 'action';
    view.setAttribute("actionId", id);
    view.onclick = onActionClick;
    view.ontouchstart = view.onmousedown = function(e) {
        var v = e.currentTarget;
        v.style.background = '#333';
        timeout = setTimeout(function() {
            v.style.background = 'transparent';
            showMenu(v);
        }, 1000);
    };
    view.ontouchend = view.onmouseup = view.onmouseout = function(e) {
        e.currentTarget.style.background = 'transparent';
        clearTimeout(timeout);
    };
    var _name = document.createElement('div');
    _name.className = 'name';
    _name.innerText = name;
    view.appendChild(_name);
    var _cost = document.createElement('div');
    _cost.className = 'cost';
    _cost.innerText = cost > 0 ? "+"+cost : cost ;
    view.appendChild(_cost);
    return view;
}

function onActionClick(e) {
    lastId = e.currentTarget.getAttribute('actionId');
    updateBalance(actions[lastId].cost);
    showUndo(actions[lastId].cost);
}

var lastView;
function showMenu(view) {
    lastView = view;
    menu.style.display = 'block';
    document.getElementById('edit').onclick = function() {
        isAdding = false;
        var id = view.getAttribute('actionId');
        document.getElementById('actionName').value = actions[id].name;
        document.getElementById('actionCost').value = actions[id].cost;
        showDialog();
        hideMenu();
    };
    document.getElementById('del').onclick = function() {
        var id = view.getAttribute('actionId');
        lastView.parentNode.removeChild(lastView);
        actions[id] = null;
        db.transaction(function(tx) {
            tx.executeSql("DELETE FROM actions WHERE id=?", [id]);
        });
        hideMenu();
    };
}

function hideMenu() {
    menu.style.display = 'none';
}

var undoTimeout;
function showUndo(text) {
    if(lastId !== null) {
        clearTimeout(undoTimeout);
        onHide();
    }
    document.getElementById('undo').style.display = 'block';
    document.getElementById('textUndo').innerText = text;
    document.getElementById('btnUndo').onclick = onUndo;
    undoTimeout = setTimeout(onHide, 4000);

}

function onUndo() {
    document.getElementById('undo').style.display = 'none';
    updateBalance(-actions[lastId].cost);
    clearTimeout(undoTimeout);
    lastId = null;
}

function onHide() {
    document.getElementById('undo').style.display = 'none';
    if(lastId === null)
        return;
    var action = actions[lastId];
    lastId = null;
    db.transaction(function(tx) {
        tx.executeSql("INSERT INTO history (name, cost, date) VALUES(?, ?, ?)", [action.name, action.cost, new Date().getTime()]);
    });
}

function updateBalance(b) {
    balance += b;
    document.getElementById('balance').innerText = balance;
}
var isAdding;
function onAddAction() {
    document.getElementById('actionName').value = '';
    document.getElementById('actionCost').value = '';
    isAdding = true;
    showDialog();
}

function showDialog() {
    dialog.style.display = 'block';
}

function hideDialog() {
    dialog.style.display = 'none';
}

function onDialogApply() {
    var name = document.getElementById('actionName').value;
    var cost = document.getElementById('actionCost').value-0;
    if(name.length == 0)
        return alert("Empty name");
    if(cost == NaN)
        return alert("Wrong cost");
    if(isAdding) {
        var id = actionId++;
        var view = getActionView(id, name, cost);
        if(cost < 0) {
            expenses.appendChild(view);
        } else {
            incomes.appendChild(view);
        }
        db.transaction(function(tx) {
            tx.executeSql("INSERT INTO actions VALUES(?, ?, ?);", [id, name, cost]);
        });
    } else {
        var id = lastView.getAttribute('actionId');
        actions[id].name = name;
        actions[id].cost = cost;
        lastView.getElementsByClassName('name')[0].innerText = name;
        lastView.getElementsByClassName('cost')[0].innerText = cost > 0 ? '+'+cost : cost;
        db.transaction(function(tx) {
            tx.executeSql("UPDATE actions SET name=?, cost=? WHERE id=?;", [name, cost, id]);
        });
    }
    hideDialog();
}
