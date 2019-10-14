const path = require('path');
let Automata = require('./automata')
var readlineSync = require('readline-sync');
const fs = require('fs');
/*
  1. Получаем от пользователя путь к валидному текстовому файлу с кодировкой UTF-8, 
     содержащему информацию об автомате 
  2. Выполняем синтаксический анализ файла, пример структуры файла:

    1. {a,b,c}; - входящие в алфавит буквы [a-zA-Z0-9]
    2. {q0, q1, q2, q3}; - набор состояний
    3. q0; - начальное состояние
    4. {q3}; - набор финальных состояний 
    5. (q0,a,q1) - переходы между состояниями (текущее_состояние,буква_из_алфавита,следующее_состояние)
    (q1,b,q2)
    (q2,c,q3)
    (q3,a,q2)

  3. Выполняем семантический анализ
  4. Выполяем оптимизацию автомата
  5. Если автомат подлежит оптимизации, демонстрируем пользователю опитимизированную версию Автомата 
*/

let regExpByRow = [
    /^1\. {[a-zA-Z\d](,[a-zA-Z\d])*};$/,
    /^2\. {[a-zA-Z]\d?(,[a-zA-Z]\d?)*};$/,
    /^3\. [a-zA-Z]\d?;$/,
    /^4\. {[a-zA-Z]\d?(,[a-zA-Z]\d?)*};$/,
    /^5\. \([a-zA-Z]\d?,[a-zA-Z\d],[a-zA-Z]\d?\)$/,
    /^\([a-zA-Z]\d?,[a-zA-Z\d],[a-zA-Z]\d?\)$/
];

function getAutomata() {
    let path = getPathFromUser('\nВведите путь к файлу с Автоматом:');
    console.log('\n1. Проверяем указывает ли путь на файл');
    while (!checkIfFileExists(path)) {
        path = getPathFromUser('Введите корректный путь к файлу с Автоматом:');
    }

    const fileStr = fs.readFileSync(path, 'utf-8');
    console.log(`Успех`);

    console.log('\n2.Выполняем синтаксический анализ содержимого');
    let strArr = syntaxAnalisis(fileStr);
    if (!strArr) {
        return getAutomata();
    };

    console.log('\n3.Выполняем семантический анализ содержимого');
    const result = semanticAnalysis(strArr);
    if (!result) {
        return getAutomata();
    }

    let myAutomata = new Automata(result);

    myAutomata.optimize();

}

function getPathFromUser(prompt) {
    if (prompt) console.log(prompt);
    return readlineSync.question('');
}

function checkIfFileExists(path) {
    if (!fs.existsSync(path)) {
        console.log(`Ошибка. Путь "${path}" указывает на несуществующее местоположение`);
        return false;
    } else if (fs.lstatSync(path).isDirectory()) {
        console.log(`Ошибка. Путь "${path}" указывает на директорию`);
        return false;
    }
    return true;
}

// Решает, соответстувет ли содеждимое файла оглашенной структуре. 
// Если нет - возвращает false, если да - возращает массив строк файла
function syntaxAnalisis(fileStr) {
    if (!fileStr) { // строка, состоящая только из знаков табуляции
        console.log('Ошибка. Данные отсутствуют');
        return false;
    }

    // Разбиваем содержимое файла на массив состоящий из строк файла  
    const strArr = fileStr.split(/\r?\n/);
    console.log('Строки файла:');
    console.log(strArr);
    if (strArr.length < 5) {
        console.log('Ошибка. В файле содержится менее 5 строк.');
        return false;
    }

    // Проверяем каждую строку на соответствие определенной для нее структуре. Смотри массив из регулярных выражений выше
    for (let i = 0; i < strArr.length; i++) {
        let regExpArrIndex = (i < 6) ? i : 5;
        if (!regExpByRow[regExpArrIndex].test(strArr[i])) {
            console.log(`Строка ${i + 1}/${strArr.length} - ошибка синтаксического анализа.`)
            console.log(`Регулярное выражение: ${regExpByRow[regExpArrIndex]}\nСтрока: ${strArr[i]}`);
            return false;
        }
    }
    console.log('Все строки успешно прошли синтаксическую проверку.');
    return strArr;
}

function semanticAnalysis(strArr) {
    let automataObj = {
        alphabet: [],
        states: [],
        initialState: '',
        finalStates: [],
        moves: []
    }

    // Получаем значения для формированмия алфавита
    let search = {
        from: strArr[0].indexOf('{') + 1,
        length: strArr[0].indexOf('}') - strArr[0].indexOf('{') - 1
    }
    automataObj.alphabet = strArr[0].substr(search.from, search.length).split(',');
    console.log('Входной алфавит:');
    console.log(automataObj.alphabet);

    //Получаем значения для составления множества состояний
    search = {
        from: strArr[1].indexOf('{') + 1,
        length: strArr[1].indexOf('}') - strArr[1].indexOf('{') - 1
    }
    automataObj.states = strArr[1].substr(search.from, search.length).split(',');
    console.log('Множество состояний:');
    console.log(automataObj.states);

    //Получем начальное состояние 
    search = {
        from: strArr[2].indexOf(' ') + 1,
        length: strArr[2].indexOf(';') - strArr[2].indexOf(' ') - 1
    }
    automataObj.initialState = strArr[2].substr(search.from, search.length);
    console.log(`Начальное состояние: "${automataObj.initialState}"`);
    if (!automataObj.states.includes(automataObj.initialState)) { // не найдено в массиве
        console.log(`Ошибка семантического анализа. Начальное состояние "${automataObj.initialState}" не входит в множество состояний`)
        return false;
    } else {
        console.log(`OK. Начальное состояние автомата "${automataObj.initialState}" входит в множество состояний`)
    }

    //Получаем финальные состояния автомата
    search = {
        from: strArr[3].indexOf('{') + 1,
        length: strArr[3].indexOf('}') - strArr[3].indexOf('{') - 1
    }
    automataObj.finalStates = strArr[3].substr(search.from, search.length).split(",");
    console.log('Множество финальных состояний автомата:');
    console.log(automataObj.finalStates);
    for (let i = 0; i < automataObj.finalStates.length; i++) {
        if (!automataObj.states.includes(automataObj.finalStates[i])) {
            console.log(`Ошибка семантического анализа. Финальное состояние "${automataObj.finalStates[i]}" не принадлежит множеству состояний`);
            return false;
        }
    }
    console.log(`Успех. Все финальные состояния принадлежат множеству состояний`);

    console.log(`Начинаем проверку оглашенных переходов между состояниями`);
    for (let i = 4; i < strArr.length; i++) {
        search = {
            from: strArr[i].indexOf('(') + 1,
            length: strArr[i].indexOf(')') - strArr[i].indexOf('(') - 1
        }
        let parsedMove = strArr[i].substr(search.from, search.length).split(',');
        /* 
            Проверяем принадлежность:
                - изначального состояния множеству состояний
                - следующего состояния множеству состояний
                - символа перехода нашему алфавиту 
        */
        if (!automataObj.states.includes(parsedMove[0])) {
            console.log(`Ошибка в строке №${i + 1}:\nИзначальное состояние перехода "${parsedMove[0]}" не входит в определенное файлом множество состояний`)
            return false;
        } else if (!automataObj.states.includes(parsedMove[2])) {
            console.log(`Ошибка в строке №${i + 1}:\nИзначальное состояние перехода "${parsedMove[2]}" не входит в определенное файлом множество состояний`)
            return false;
        } else if (!automataObj.alphabet.includes(parsedMove[1])) {
            console.log(`Ошибка в строке №${i + 1}:\nСимвол перехода "${parsedMove[1]}" не входит в указанный файлом алфавит`)
            return false;
        }
        automataObj.moves.push(parsedMove);
    }
    /* 
        На текущем этапе выполнения програмы мы должны опеределить
        является ли предложенный пользователем автомат детерминированным.
        Детерменнированным считается автомат для которого
        из любого состояния по любому символу возможен переход не более, чем в одно состояние
    */
    for (let i = 0; i < automataObj.moves.length; i++) {
        for (let k = i + 1; k < automataObj.moves.length; k++) {
            const moveA = automataObj.moves[i];
            const moveB = automataObj.moves[k];
            //                                                      index = 0           index = 1       index = 2
            // Переход хранится в виде массива из 3 елементов: { начальное_состояние, символ_перехода, следующее_состояние }
            if (moveA[0] == moveB[0] && moveA[1] == moveB[1]) {
                console.log(`Ошибка. Найдено два перехода с одинаковыми начальным состоянием и символом перехода:`);
                console.log(`"${moveA}" и "${moveB}"`);
                return false;
            }
        }
    }
    console.log("Успех. Все переходы прошли проверку.");
    return automataObj;
}

getAutomata()