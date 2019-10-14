function arraysEqual(arr1, arr2) {
    try {
        for (let i = 0; i < arr1.length; i++) {
            for (let k = 0; k < arr1[i].length; k++) {
                if (arr1[i][k] != arr2[i][k]) {
                    return false;
                }
            }
        }
        return true;
    } catch (error) {
        return false;
    }
}

module.exports = class Automata {
    constructor(automataObj) {
        if (!automataObj) {
            console.log(`Ошибка при инициализации экземпляра Автомата. Данные не переданы.`)
            return;
        }
        this.alphabet = automataObj.alphabet;
        this.states = {};
        this.finalStates = automataObj.finalStates;
        this.initialState = automataObj.initialState;
        this.currentState = this.initialState;

        automataObj.states.forEach(state => {
            let newStateObj = {};
            let selectedMoves = automataObj.moves.filter(move => move[0] == state);
            selectedMoves.forEach(selectedMove => {
                newStateObj[selectedMove[1]] = selectedMove[2];
            });
            this.states[state] = newStateObj;
        });
        console.log("Представление Автомата в памяти ЭВМ:\n");
        console.log(this);
        console.log();
    }

    process(string) {
        this.currentState = this.initialState;
        if (!string) {
            console.log('Ошибка. Слово для анализа отсутствует.\n');
            return false;
        } else if (typeof string !== 'string') {
            console.log('Ошибка. Полученные данные не являются строкой\n');
            return false;
        }
        console.log(`Начинаем тестовую проверку слова "${string}"`);

        for (let i = 0; i < string.length; i++) {
            const currentSymbol = string[i];
            let newState = this.states[this.currentState][currentSymbol];
            console.log(` ${this.currentState} -- ${currentSymbol} --> ${newState}`);
            if (typeof newState === "undefined") {
                console.log(`Результат: Ошибка. Слово "${string}" не допускается\n`);
                return false;
            }
            this.currentState = newState;
        }

        if (this.finalStates.includes(this.currentState)) {
            console.log(`Результат: Успех. Слово "${string}" допускается\n`);
            return true;
        } else {
            console.log(`Результат: Ошибка. Слово "${string}" не допускается\n`);
            return false;
        }
    }

    deleteUnreachableStates() {
        let reachableStates = [this.initialState];
        let foundNew = false;
        do {
            foundNew = false;
            reachableStates.forEach(state => {
                Object.keys(this.states[state]).forEach(letter => {
                    let newState = this.states[state][letter];
                    if (!reachableStates.includes(newState)) {
                        reachableStates.push(newState);
                        foundNew = true;
                    }
                })
            })
        } while (foundNew)
        const statesToDelete = Object.keys(this.states).diff(reachableStates);

        /* 
            Удалить состояние означает: 
                 - Удалить его из списка финальных состояний
                 - Удалить само состояние из списка состояний
                 - Удалить все переходы, ведущие к этому состоянию (не применяется для недостижимых состояний
                    
        */
        statesToDelete.forEach(state => {
            let indexInFinalStatesArray = this.finalStates.indexOf(state);
            if (indexInFinalStatesArray >= 0) {
                this.finalStates.splice(indexInFinalStatesArray, 1);
            }
            delete this.states[state];
        });

        Object.keys(this.states).forEach(state => {
            Object.keys(this.states[state]).forEach(symbol => {
                if (statesToDelete.includes(this.states[state][symbol])) {
                    delete this.states[state][symbol];
                }
            });
        });
        if (statesToDelete.length > 0) {
            console.log('Недостижимые состояния:');
            console.log(statesToDelete);
            console.log('Представление Автомата после удаления недостижимых состояний:');
            console.log(this);
        } else {
            console.log('Недостижимые состояния отсутствуют');
        }
        console.log();
    }

    deleteDeadStates() {
        /*
            Тупиковым состоянием называется нефинальное состояние от которого отсутствуют переходы к другим состояниям
        */
        let statesToDelete = [];
        let deletedStates = [];
        do {
            statesToDelete.forEach(state => {
                delete this.states[state];
            });

            Object.keys(this.states).forEach(state => {
                Object.keys(this.states[state]).forEach(symbol => {
                    if (statesToDelete.includes(this.states[state][symbol])) {
                        delete this.states[state][symbol];
                    }
                });
            });

            statesToDelete = [];
            Object.keys(this.states).forEach(state => {
                if (!this.finalStates.includes(state) && state != this.initialState && this.doesntPointOnOtherStates(state, this.states[state])) {
                    statesToDelete.push(state);
                    deletedStates.push(state);
                }
            });
        } while (statesToDelete.length != 0)
        if (deletedStates.length > 0) {
            console.log('Найденные тупиковые состояния:');
            console.log(deletedStates);
            console.log('Представление Автомата после удаления тупиковых состояний:');
            console.log(this);
        } else {
            console.log('Тупиковые состояния отсутствуют');
        }
        console.log();
    }

    doesntPointOnOtherStates(state, moves) {
        const letters = Object.keys(moves);
        for (let i = 0; i < letters.length; i++) {
            if (state != moves[letters[i]]) {
                return false;
            }
        }
        return true;
    }

    /* 
        Ищем эквивалентные состояния при помощи алгоритма Хопкрофта:
        https://en.wikipedia.org/wiki/DFA_minimization
        А затем "склеиваем" их, получая новый, оптимизированный Автомат
    */
    removeEquivalent() {
        console.log('Начинаем поиск эквивалентных состояний при помощи алгоритма Хопкрофта:')
        let nMinusOneEq = [this.finalStates, Object.keys(this.states).diff(this.finalStates)];
        let nEq = [];
        let index = 0;
        do {
            nMinusOneEq.forEach(eqGroup => {
                let currGroup = [...eqGroup];
                let newEqGroups = [
                    [currGroup.shift()]
                ];
                currGroup.forEach(state => {
                    for (let i = 0; i < newEqGroups.length; i++) {
                        if (this.checkIfNEq(state, newEqGroups[i][0], nMinusOneEq)) {
                            newEqGroups[i].push(state);
                            return;
                        }
                    }
                    newEqGroups.push([state]);
                })
                nEq = nEq.concat(newEqGroups);
            });
            console.log(`${index++} Эвивалентные группы состояний:`)
            console.log(nMinusOneEq);
            console.log();
            if (arraysEqual(nEq, nMinusOneEq)) {
                break;
            } else {
                nMinusOneEq = nEq;
                nEq = [];
            }
        } while (true)

        nMinusOneEq.forEach((group, index) => {
            let newStateName = String.fromCharCode(65 + index);
            let movesToSave = [];
            Object.keys(this.states).forEach(state => {
                Object.getOwnPropertyNames(this.states[state]).forEach(letter => {
                    if (group.includes(this.states[state][letter])) {
                        this.states[state][letter] = newStateName;
                    }
                });
            })
            Object.keys(this.states).forEach(state => {
                if (group.includes(state)) {
                    movesToSave.push(this.states[state]);
                    delete this.states[state];
                }
            })
            let newMoves = {};
            movesToSave.forEach(moves => {
                Object.getOwnPropertyNames(moves).forEach(letter => {
                    newMoves[letter] = moves[letter];
                })
            });
            this.states[newStateName] = newMoves;

            if (group.includes(this.initialState)) {
                this.initialState = newStateName;
                this.currentState = newStateName;
            }
            for (let i = 0; i < this.finalStates.length; i++) {
                if (group.includes(this.finalStates[i])) {
                    this.finalStates[i] = newStateName;
                }
            }

            // Удаляем повторения из массива финальных состояний
            this.finalStates = this.finalStates.filter((item, pos) => {
                return this.finalStates.indexOf(item) == pos;
            })
        })
        console.log("Представление Автомата в памяти ЭВМ после завершения процесса минимизации:\n");
        console.log(this);
    }

    checkIfNEq(stateA, stateB, nMinusOneEq) {
        let values = Object.values(this.states[stateA]).concat(Object.values(this.states[stateB]));
        for (let bucket = 0; bucket < nMinusOneEq.length; bucket++) {
            if (this.isIncluded(nMinusOneEq[bucket], values)) {
                return true;
            }
        }
        return false;
    }

    isIncluded(arr1, arr2) {
        for (let index = 0; index < arr2.length; index++) {
            if (!arr1.includes(arr2[index])) {
                return false;
            }
        }
        return true;
    }

    optimize() {

        /* 
            Метод ниже будет использоваться для удобной работы с массивами, вычисления разности множеств
        */
        Array.prototype.diff = function(a) {
            return this.filter(function(i) { return a.indexOf(i) < 0; });
        };

        this.deleteUnreachableStates();
        this.deleteDeadStates();
        this.removeEquivalent();
    }
}