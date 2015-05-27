var Genetical = require('../lib/genetical');

var options = {
    populationSize: 100,
    populationFactory: populationFactory,
    terminationCondition: terminationCondition,
    fitnessEvaluator: fitnessEvaluator,
    natural: false,
    evolutionStrategy: [Genetical.CROSSOVER, Genetical.MUTATION],
    evolutionOptions: {
        crossover: crossover,
        mutate: mutate,
        mutationProbability : 0.02
    },
    islandOptions: {
        islands: 5,
        migration: 0.1,
        epoch: 10
    },
    elitism: 0.05,
    seed: 2
};

var stringAlgorithm = new Genetical(options);

var alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ ";
var solution = process.argv[2] || 'HELLO WORLD';
solution = /^[zA-Z\s]*$/.test(solution) ? solution.toUpperCase() : 'HELLO WORLD';

var population;
stringAlgorithm.on('initial population created', function (initialPopulation) {
    //console.log('initial population created', initialPopulation);
    if (!population) {
        population = initialPopulation;
    }
});

stringAlgorithm.on('population evaluated', function (population) {
    //console.log('population evaluated', population);
});

stringAlgorithm.on('stats updated', function (stats) {
    //console.log('stats updated', stats.generation, stats.bestCandidate);
});

stringAlgorithm.on('error', function (err) {
    console.log('error', err);
});

stringAlgorithm.solve(function (bestCandidate, generation) {
    console.log('Best Candidate', bestCandidate, 'Generation', generation);

    options.selectionStrategy = Genetical.STOCHASTICUNIVERSALSAMPLING;
    stringAlgorithm = new Genetical(options);

    stringAlgorithm.solve(population, function (bestCandidate, generation) {
        console.log('Best Candidate', bestCandidate, 'Generation', generation);

        options.selectionStrategy = Genetical.RANK;
        stringAlgorithm = new Genetical(options);

        stringAlgorithm.solve(population, function (bestCandidate, generation) {
            console.log('Best Candidate', bestCandidate, 'Generation', generation);

            options.selectionStrategy = Genetical.TOURNAMENT;
            options.selectionStrategyOptions = {
                tournamentSelection: 0.7
            };

            stringAlgorithm = new Genetical(options);

            stringAlgorithm.solve(population, function (bestCandidate, generation) {
                console.log('Best Candidate', bestCandidate, 'Generation', generation);

                options.selectionStrategy = Genetical.SIGMASCALING;

                stringAlgorithm = new Genetical(options);

                stringAlgorithm.solve(population, function (bestCandidate, generation) {
                    console.log('Best Candidate', bestCandidate, 'Generation', generation);
                });
            });
        });
    });
});

function populationFactory(population, populationSize, generator, callback) {
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