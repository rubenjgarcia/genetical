var Genetical = require('../lib/genetical');

var options = {
    populationSize: 10,
    populationFactory: populationFactory,
    terminationCondition: terminationCondition,
    fitnessEvaluator: fitnessEvaluator,
    natural: false,
    evolutionOptions: {
        crossover: crossover,
        mutate: mutate,
        mutationProbability : 0.1
    },
    islandOptions: {
        islands: 5,
        migration: 0.1,
        epoch: 10
    },
    seed: 2
};

var ga = new Genetical(options);

var population;
ga.on('initial population created', function (initialPopulation) {
    //console.log('initial population created', initialPopulation);
    if (!population) {
        population = initialPopulation;
    }
});

ga.on('population evaluated', function (population) {
    //console.log('population evaluated', population);
});

ga.on('stats updated', function (stats) {
    //console.log('stats updated', stats.generation, stats.bestCandidate);
});

ga.on('error', function (err) {
    console.log('error', err);
});

ga.solve(function (bestCandidate, generation) {
    console.log('Best Candidate', bestCandidate, 'Generation', generation);

    options.selectionStrategy = Genetical.STOCHASTICUNIVERSALSAMPLING;
    ga = new Genetical(options);

    ga.solve(population, function (bestCandidate, generation) {
        console.log('Best Candidate', bestCandidate, 'Generation', generation);

        options.selectionStrategy = Genetical.RANK;
        ga = new Genetical(options);

        ga.solve(population, function (bestCandidate, generation) {
            console.log('Best Candidate', bestCandidate, 'Generation', generation);

            options.selectionStrategy = Genetical.TOURNAMENT;
            options.selectionStrategyOptions = {
                tournamentSelection: 0.7
            };

            ga = new Genetical(options);

            ga.solve(population, function (bestCandidate, generation) {
                console.log('Best Candidate', bestCandidate, 'Generation', generation);

                options.selectionStrategy = Genetical.SIGMASCALING;

                ga = new Genetical(options);

                ga.solve(population, function (bestCandidate, generation) {
                    console.log('Best Candidate', bestCandidate, 'Generation', generation);
                });
            });
        });
    });
});

function populationFactory(population, populationSize, generator, callback) {
    var candidate = {
        a: getRandomInt(1, 30, generator),
        b: getRandomInt(1, 30, generator),
        c: getRandomInt(1, 30, generator),
        d: getRandomInt(1, 30, generator)
    };

    return callback(null, candidate);
}

function fitnessEvaluator(candidate, callback) {
    var fitness = Math.abs((candidate.a + candidate.b * 2 + candidate.c * 3 + candidate.d * 4) - 30);

    return callback(null, fitness);
}

function crossover(parent1, parent2, points, generator, callback) {
    var child1 = {
        a: parent1.a,
        b: parent1.b,
        c: parent1.c,
        d: parent1.d
    };

    var child2 = {
        a: parent2.a,
        b: parent2.b,
        c: parent2.c,
        d: parent2.d
    };

    var values = 'abcd';
    for (var i = 0; i < points; i++)
    {
        var crossoverIndex = getRandomInt(1, 3, generator);
        var substr = values.substr(crossoverIndex);
        var temp = {};
        for (var j = 0; j<substr.length; j++) {
            temp[substr.charAt(j)] = child1[substr.charAt(j)];
        }

        for (var j = 0; j<substr.length; j++) {
            child1[substr.charAt(j)] = child2[substr.charAt(j)];
        }

        for (var j = 0; j<substr.length; j++) {
            child2[substr.charAt(j)] = temp[substr.charAt(j)];
        }
    }

    return callback([child1, child2]);
}

function mutate (candidate, mutationProbability, generator, callback) {
    var values = 'abcd';
    for (var i = 0; i < 4; i++)
    {
        if (generator.random() < mutationProbability)
        {
            candidate[values.charAt(i)] = getRandomInt(1, 30, generator);
        }
    }

    callback(candidate);
}

function terminationCondition(stats) {
    return (stats.bestScore === 0) || stats.generation === 5000;
}

function getRandomInt(min, max, generator) {
    return Math.floor(generator.random() * (max - min + 1)) + min;
}