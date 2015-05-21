var Genetical = require('../lib/genetical');

var options = {
    populationSize: 100,
    populationFactory: populationFactory,
    terminationCondition: terminationCondition,
    fitnessEvaluator: fitnessEvaluator,
    natural: false,
    evolutionOptions: {
        crossover: crossover,
        mutate: mutate,
        mutationProbability : 0.02
    },
    elitism: 0.05,
    seed: 2
};

var stringAlgorithm = new Genetical(options);

var alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ ";
var solution = 'HELLO WORLD';

stringAlgorithm.on('initial population created', function (population) {
    console.log('initial population created', population);
});

stringAlgorithm.on('population evaluated', function (population) {
    //console.log('population evaluated', population);
});

stringAlgorithm.on('stats updated', function (stats) {
    console.log('stats updated', stats.generation, stats.bestCandidate);
});

stringAlgorithm.on('error', function (err) {
    console.log('error', err);
});

stringAlgorithm.on('evolution', function (generation, population, solution) {
    console.log('evolution', generation, solution);
});

stringAlgorithm.solve(function (result) {
    console.log('result', result);

    options.selectionStrategy = Genetical.STOCHASTICUNIVERSALSAMPLING;
    stringAlgorithm = new Genetical(options);

    stringAlgorithm.solve(function (result) {
        console.log('result', result);

        options.selectionStrategy = Genetical.RANK;
        stringAlgorithm = new Genetical(options);

        stringAlgorithm.solve(function (result) {
            console.log('result', result);

            options.selectionStrategy = Genetical.TOURNAMENT;
            options.selectionStrategyOptions = {
                tournamentSelection: 0.7
            };

            stringAlgorithm = new Genetical(options);

            stringAlgorithm.solve(function (result) {
                console.log('result', result);
            });
        });
    });
});

function populationFactory(generator, callback) {
    var string = '';

    for( var i=0; i < solution.length; i++ ) {
        string += alphabet.charAt(Math.floor(generator.random() * alphabet.length));
    }

    return callback(null, {value: string});
}

function mutate(candidate, mutationProbability, generator, callback) {
    for (var i = 0; i < candidate.value.length; i++)
    {
        if (generator.random() < mutationProbability)
        {
            var charIndex = getRandomInt(0, alphabet.length - 1, generator);
            var char = alphabet.charAt(charIndex);
            candidate.value = setCharAt(candidate.value, i, char);
        }
    }

    callback(candidate);
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

function terminationCondition(stats) {
    return (stats.bestScore === 0) || stats.generation === 5000;
}

function crossover(parent1, parent2, points, generator, callback) {
    var child1 = {value: parent1.value};
    var child2 = {value: parent2.value};

    for (var i = 0; i < points; i++)
    {
        var crossoverIndex = (1 + getRandomInt(0, parent1.value.length - 1, generator));
        for (var j = 0; j < crossoverIndex; j++)
        {
            var temp = child1.value.charAt(j);
            child1.value = setCharAt(child1.value, j, child2.value.charAt(j));
            child2.value = setCharAt(child2.value, j, temp);
        }
    }

    return callback([child1, child2]);
}

function setCharAt(string, index, char) {
    return string.substr(0, index) + char + string.substr(index+char.length);
}

function getRandomInt(min, max, generator) {
    return Math.floor(generator.random() * (max - min + 1)) + min;
}