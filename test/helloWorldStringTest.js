var Genetical = require('../lib/genetical');

var stringAlgorithm = new Genetical({
    populationSize: 200,
    candidateFactory: candidateFactory,
    terminationCondition: terminationCondition,
    fitnessEvaluator: fitnessEvaluator,
    natural: false,
    crossover: crossover,
    mutationProbability : 0.02,
    mutate: mutate,
    elitism: 0.05
});

var alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ ";
var solution = 'HELLO WORLD';

stringAlgorithm.on('error', function (err) {
    console.log('error', err);
});

stringAlgorithm.on('init', function (population) {
    console.log('init', population);
});

stringAlgorithm.on('evolution', function (generation, population, solution) {
    console.log('evolution', generation, solution);
});

stringAlgorithm.evolve(function (result) {
    console.log('result', result);
});

function candidateFactory(callback) {
    var string = '';

    for( var i=0; i < solution.length; i++ ) {
        string += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }

    return callback(null, {value: string});
}

function mutate(candidate, callback) {
    var index = getRandomInt(candidate.value.length - 1);
    var charIndex = getRandomInt(alphabet.length - 1);
    var char = candidate.value.charAt(charIndex);
    candidate.value = setCharAt(candidate.value, index, char);
    callback(candidate);
}

function setCharAt(string, index, char) {
    return string.substr(0, index) + char + string.substr(index+char.length);
}

function fitnessEvaluator(candidate, callback) {
    var errors = 0;
    for (var i = 0; i < candidate.value.length; i++)
    {
        if (candidate.value.charAt(i) !== solution.charAt(i))
        {
            ++errors;
        }
    }

    return callback(null, errors);
}

function terminationCondition() {
    return (this.solution && this.solution.score === 0) || this.generation === 1000;
}

function crossover(parent1, parent2, points, callback) {
    var child1 = {value: parent1.value};
    var child2 = {value: parent2.value};

    for (var i = 0; i < points; i++)
    {
        var crossoverIndex = (1 + getRandomInt(parent1.value.length - 1));
        for (var j = 0; j < crossoverIndex; j++)
        {
            var temp = child1.value.charAt(j);
            child1.value = setCharAt(child1.value, j, child2.value.charAt(j));
            child2.value = setCharAt(child2.value, j, temp);
        }
    }

    return callback([child1, child2]);
}

function getRandomInt(min, max) {
    if (!max) {
        max = min;
        min = 0;
    }

    return Math.floor(Math.random() * (max - min + 1)) + min;
}