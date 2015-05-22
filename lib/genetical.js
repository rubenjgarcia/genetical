'use strict';

var _ = require('lodash');
var EventEmitter = require('events').EventEmitter;

var MersenneTwister = require('mersenne-twister');
var async = require('async');

function Genetical(options) {
    this.populationSize = options.populationSize;
    this.populationFactory = options.populationFactory;
    this.fitnessEvaluator = options.fitnessEvaluator;
    this.natural = (options.natural !== undefined && options.natural !== null ? options.natural : true);
    this.terminationCondition = options.terminationCondition;
    this.elitism = options.elitism || 0;
    this.selectionStrategy = options.selectionStrategy || Genetical.ROULETTEWHEELSELECTION;
    this.evolutionStrategies = [Genetical.CROSSOVER, Genetical.MUTATION];
    this.evolutionOptions = options.evolutionOptions || {};
    this.selectionStrategyOptions = options.selectionStrategyOptions || {};

    this.seed = options.seed;

    var self = this;
    this.generateInitialPopulation = function (callback) {
        async.until(function () {
            return (self.population.length >= self.populationSize);
        }, function (cb) {
            self.populationFactory(self.population.length, self.populationSize, self.generator, function (err, candidate) {
                if (err) {
                    cb(err);
                }

                if (_.isArray(candidate)) {
                    self.population = self.population.concat(candidate);
                }
                else {
                    self.population.push(candidate);
                }

                cb();
            });
        }, function (err) {
            if (err) {
                return callback(err);
            }

            self.emit('initial population created', self.population);
            callback();
        });
    };

    this.evaluatePopulation = function (callback) {
        async.each(self.population, function (candidate, cb) {
            self.fitnessEvaluator(candidate, function (err, score) {
                candidate.score = score;
                cb();
            });
        }, function (err) {
            self.emit('population evaluated', self.population);
            callback();
        });
    };

    this.sortPopulation = function (callback) {
        setImmediate(function () {
            self.population = _.sortBy(self.population, function (candidate) {
                return (self.natural ? -candidate.score : candidate.score);
            });

            callback();
        });
    };

    this.updateStats = function (callback) {
        self.stats = {
            dataSet: [],
            dataSetSize: 0,
            total: 0,
            product: 1,
            reciprocalSum: 0,
            minimum: Number.MAX_VALUE,
            maximum: Number.MIN_VALUE
        };

        self.population.forEach(function (candidate) {
            self.stats.dataSet.push(candidate.score);
            self.stats.dataSetSize++;
            self.stats.total += candidate.score;
            self.stats.product *= candidate.score;
            self.stats.reciprocalSum += 1 / candidate.score;
            self.stats.minimum = Math.min(self.stats.minimum, candidate.score);
            self.stats.maximum = Math.max(self.stats.maximum, candidate.score);
        });

        self.stats.bestCandidate = self.population[0];
        self.stats.bestScore = self.population[0].score;
        self.stats.mean = self.stats.total / self.stats.dataSetSize;

        var squaredDiffs = 0;
        for (var i = 0; i < self.stats.dataSetSize; i++)
        {
            var diff = self.stats.mean - self.stats.dataSet[i];
            squaredDiffs += (diff * diff);
        }

        var variance = squaredDiffs / self.stats.dataSetSize;
        self.stats.standardDeviaton = Math.sqrt(variance);
        self.stats.generation = self.generation;

        self.emit('stats updated', self.stats);
        callback();
    };

    this.evolve = function (callback) {
        var newPopulation = [];
        var elite = [];

        self.eliteCount = self.populationSize * self.elitism;
        for (var i = 0; i < self.eliteCount; i++)
        {
            elite.push(self.population[i]);
        }

        if (_.indexOf([Genetical.ROULETTEWHEELSELECTION, Genetical.STOCHASTICUNIVERSALSAMPLING, Genetical.RANK, Genetical.TOURNAMENT, Genetical.SIGMASCALING], self.selectionStrategy) === -1) {
            throw "'selectionStrategy' must be Genetical.ROULETTEWHEELSELECTION, Genetical.STOCHASTICUNIVERSALSAMPLING, Genetical.RANK, Genetical.TOURNAMENT or Genetical.SIGMASCALING"
        }

        switch (self.selectionStrategy) {
            case Genetical.ROULETTEWHEELSELECTION:
                newPopulation = self.rouletteWheelSelection();
                break;
            case Genetical.STOCHASTICUNIVERSALSAMPLING:
                newPopulation = self.stochasticUniversalSampling();
                break;
            case Genetical.RANK:
                newPopulation = self.rankSelection();
                break;
            case Genetical.TOURNAMENT:
                if (!self.selectionStrategyOptions.tournamentSelection || _.isNaN(self.selectionStrategyOptions.tournamentSelection) || self.selectionStrategyOptions.tournamentSelection <= 0.5) {
                    throw "'selectionStrategyOptions.tournamentSelection' must be defined and must be a greater than 0.5"
                }
                newPopulation = self.tournamentSelection();
                break;
            case Genetical.SIGMASCALING:
                newPopulation = self.sigmaScaling();
                break;
        }

        if (_.indexOf(self.evolutionStrategies, Genetical.CROSSOVER) !== -1) {
            newPopulation = self.crossover(newPopulation);
        }

        if (_.indexOf(self.evolutionStrategies, Genetical.MUTATION) !== -1) {
            newPopulation = self.mutate(newPopulation);
        }

        elite.forEach(function (candidate) {
            newPopulation.push(candidate);
        });

        self.population = newPopulation;
        callback();
    };

    var self = this;
    var adjustScore = function (score) {
        if (self.natural) {
            return score;
        }
        return score == 0 ? Number.POSITIVE_INFINITY : 1/score;
    };

    this.rouletteWheelSelection = function () {
        var cumulativeFitnesses = [];
        cumulativeFitnesses.push(adjustScore(this.population[0].score));

        for (var i = 1; i<this.population.length; i++) {
            var score = adjustScore(this.population[i].score);
            cumulativeFitnesses.push(cumulativeFitnesses[i-1] + score);
        }

        var binaryIndexOf = function (array, key) {
            var l = 0,
                h = array.length - 1,
                m, comparison;

            var comparator = function (a, b) {
                return (a < b ? -1 : (a > b ? 1 : 0));
            };

            while (l <= h) {
                m = (l + h) >>> 1;
                comparison = comparator(array[m], key);
                if (comparison < 0) {
                    l = m + 1;
                } else if (comparison > 0) {
                    h = m - 1;
                } else {
                    return m;
                }
            }
            return ~l;
        };

        var newPopulation = [];
        var selectionSize = this.populationSize - this.eliteCount;
        for (i = 0; i < selectionSize; i++)
        {
            var randomFitness = this.generator.random() * cumulativeFitnesses[cumulativeFitnesses.length - 1];
            var index = binaryIndexOf(cumulativeFitnesses, randomFitness);
            if (index < 0)
            {
                index = Math.abs(index + 1);
            }

            newPopulation.push(this.population[index]);
        }

        return newPopulation;
    };

    this.stochasticUniversalSampling = function (population, selectionSize) {
        var population = population || this.population;
        var aggregateFitness = 0;
        for (var i = 1; i<population.length; i++) {
            aggregateFitness += adjustScore(population[i].score);
        }

        var startOffset = this.generator.random();
        var cumulativeExpectation = 0;
        var index = 0;
        var selectionSize = selectionSize || this.populationSize - this.eliteCount;
        var newPopulation = [];

        for (var i = 1; i<population.length; i++) {
            cumulativeExpectation += adjustScore(population[i].score) / aggregateFitness * selectionSize;

            while (cumulativeExpectation > startOffset + index)
            {
                newPopulation.push(population[i]);
                index++;
            }
        }
        return newPopulation;
    };

    this.rankSelection = function () {
        var rankedPopulation = [];
        var index = -1;
        for (var i = 1; i<this.population.length; i++) {
            var candidate = this.population[i];
            candidate.score = ++index - this.population.length;
            rankedPopulation.push(candidate);
        }
        return self.stochasticUniversalSampling(rankedPopulation, this.populationSize - this.eliteCount);
    };

    this.tournamentSelection = function () {
        var newPopulation = [];
        var selectionSize = this.populationSize - this.eliteCount;

        var getRandomInt = function (min, max, generator) {
            return Math.floor(generator.random() * (max - min + 1)) + min;
        };

        for (var i = 0; i < selectionSize; i++) {
            var index1 = getRandomInt(0, this.population.length - 1, this.generator);
            var candidate1 = this.population[index1];
            var index2 = getRandomInt(0, this.population.length - 1, this.generator);
            var candidate2 = this.population[index2];

            var selectFitter = this.generator.random() <= this.selectionStrategyOptions.tournamentSelection;
            if (selectFitter === this.natural) {
                newPopulation.push(candidate2.score > candidate1.score ? candidate2 : candidate1);
            }
            else {
                newPopulation.push(candidate2.score > candidate1.score ? candidate1 : candidate2);
            }
        }

        return newPopulation;
    };

    this.sigmaScaling = function () {
        var scaledPopulation = [];
        var getSigmaScaledFitness = function (candidateFitness, populationMeanFitness, fitnessStandardDeviation) {
            if (fitnessStandardDeviation == 0) {
                return 1;
            }
            else
            {
                var scaledFitness = 1 + (candidateFitness - populationMeanFitness) / (2 * fitnessStandardDeviation);
                return scaledFitness > 0 ? scaledFitness : 0.1;
            }
        };

        for (var i = 1; i<this.population.length; i++) {
            var candidate = this.population[i];
            var scaledFitness = getSigmaScaledFitness(candidate, this.stats.mean, this.stats.standardDeviaton);
            candidate.score = scaledFitness;
            scaledPopulation.push(candidate);
        }

        return self.stochasticUniversalSampling(scaledPopulation, this.populationSize - this.eliteCount);
    };

    this.crossover = function (population) {
        var crossover = this.evolutionOptions.crossover;
        if (!crossover || !_.isFunction(crossover)) {
            throw "'evolutionOptions.crossover' must be defined and must be a function"
        }

        var crossoverPoints = this.evolutionOptions.crossoverPoints || 1;
        if (_.isNaN(crossoverPoints) || crossoverPoints <= 0) {
            throw "'evolutionOptions.crossoverPoints' must be defined and must be a greater than 0"
        }

        var newPopulation = [];
        var index = 0;
        while (index < population.length) {
            var parent1 = population[index];
            index++;
            if (index < population.length) {
                var parent2 = population[index];
                index++;

                crossover(parent1, parent2, crossoverPoints, this.generator, function (children) {
                    children.forEach(function (child) {
                        newPopulation.push(child);
                    });
                });
            }
            else {
                newPopulation.push(parent1);
            }
        }

        return newPopulation;
    };

    this.mutate = function (population) {
        var mutate = this.evolutionOptions.mutate;
        if (!mutate || !_.isFunction(mutate)) {
            throw "'evolutionOptions.mutate' must be defined and must be a function"
        }

        var mutationProbability = this.evolutionOptions.mutationProbability || 1;
        if (_.isNaN(mutationProbability) || mutationProbability <= 0 || mutationProbability > 1) {
            throw "'evolutionOptions.mutationProbability' must be greater than 0 and less than 1"
        }

        var newPopulation = [];

        var self = this;
        population.forEach(function (candidate) {
            mutate(candidate, mutationProbability, self.generator, function (candidate) {
                newPopulation.push(candidate);
            });
        });

        return newPopulation;
    }
}

Genetical.prototype = new EventEmitter();

Object.defineProperty(Genetical, "ROULETTEWHEELSELECTION", {
    enumerable: false,
    configurable: false,
    writable: false,
    value: 1
});

Object.defineProperty(Genetical, "STOCHASTICUNIVERSALSAMPLING", {
    enumerable: false,
    configurable: false,
    writable: false,
    value: 2
});

Object.defineProperty(Genetical, "RANK", {
    enumerable: false,
    configurable: false,
    writable: false,
    value: 3
});

Object.defineProperty(Genetical, "TOURNAMENT", {
    enumerable: false,
    configurable: false,
    writable: false,
    value: 4
});

Object.defineProperty(Genetical, "SIGMASCALING", {
    enumerable: false,
    configurable: false,
    writable: false,
    value: 5
});


Object.defineProperty(Genetical, 'CROSSOVER', {
    enumerable: false,
    configurable: false,
    writable: false,
    value: 'CROSSOVER'
});

Object.defineProperty(Genetical, 'MUTATION', {
    enumerable: false,
    configurable: false,
    writable: false,
    value: 'MUTATION'
});

Genetical.prototype.solve = function (callback) {
    if (!this.populationSize || _.isNaN(this.populationSize) || this.populationSize <= 0) {
        throw "'populationSize' must be defined and must be a greater than 0"
    }

    if (!this.populationFactory || !_.isFunction(this.populationFactory)) {
        throw "'populationFactory' must be defined and must be a function"
    }

    if (!this.fitnessEvaluator || !_.isFunction(this.fitnessEvaluator)) {
        throw "'fitnessEvaluator' must be defined and must be a function"
    }

    if (!this.terminationCondition || !_.isFunction(this.terminationCondition)) {
        throw "'terminationCondition' must be defined and must be a function"
    }

    if (this.elitism < 0 || this.elitism >= 1)
    {
        throw "'elitism' must be non-negative and less than 1";
    }

    if (this.seed && (_.isNaN(this.seed) || !(parseInt(Number(this.seed)) == this.seed && !isNaN(parseInt(this.seed, 10))))) {
        throw "'seed' must be an integer"
    }

    this.generator = this.seed ? new MersenneTwister(this.seed) : new MersenneTwister();

    this.generation = 0;
    this.population = [];

    var self = this;
    async.series([
            this.generateInitialPopulation,
            this.evaluatePopulation,
            this.sortPopulation,
            this.updateStats
        ],
        function (err) {
            if (err) {
                self.emit('error', err);
                return null;
            }

            async.until(function () {
                return self.terminationCondition(self.stats);
            }, function (cb) {
                self.generation++;
                async.series([
                    self.evolve,
                    self.evaluatePopulation,
                    self.sortPopulation,
                    self.updateStats
                ], function (err) {
                    if (err) {
                        self.emit('error', err);
                    }
                    cb(err);
                });
            }, function () {
                callback(self.stats.bestCandidate);
            });
        });
};

module.exports = Genetical;