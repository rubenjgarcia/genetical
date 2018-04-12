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
    this.evolutionStrategy = options.evolutionStrategy || [Genetical.CROSSOVER, Genetical.MUTATION];
    this.evolutionOptions = options.evolutionOptions || undefined;
    this.selectionStrategyOptions = options.selectionStrategyOptions || undefined;
    this.seed = options.seed;

    this.islandOptions = options.islandOptions || undefined;
    this.islands = [];

    var self = this;
    this.generateInitialPopulation = function (callback) {
        if (self.islandOptions) {
            for (var i=0; i<self.islandOptions.islands;i++) {
                self.islands.push({population: []});
            }

            self.generateIslandsPopulation(callback);
        }
        else {
            if (self.initialPopulation) {
                self.population = self.initialPopulation;
                callback();
            }
            else {
                self.generateSinglePopulation(callback);
            }
        }
    };

    this.generateSinglePopulation = function (callback) {
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

    this.generateIslandsPopulation = function (callback) {
        async.times(self.islandOptions.islands, function (n, next) {
            async.until(function () {
                return (self.islands[n].population.length >= self.populationSize);
            }, function (cb) {
                self.populationFactory(self.islands[n].population.length, self.populationSize, self.generator, function (err, candidate) {
                    if (err) {
                        cb(err);
                    }

                    if (_.isArray(candidate)) {
                        self.islands[n].population = self.islands[n].population.concat(candidate);
                    }
                    else {
                        self.islands[n].population.push(candidate);
                    }

                    cb();
                });
            }, function (err) {
                next(err);
            });
        }, function (err) {
            if (err) {
                return callback(err);
            }

            self.emit('initial population created', self.islands);
            callback();
        });
    };

    this.evaluatePopulation = function (callback) {
        if (self.islandOptions) {
            async.each(self.islands, function (island, islandCb) {
                async.each(island.population, function (candidate, cb) {
                    self.fitnessEvaluator(candidate, function (err, score) {
                        candidate.score = score;
                        cb(err);
                    });
                }, function (err) {
                    islandCb(err);
                });
            }, function (err) {
                if (err) {
                    return callback(err);
                }

                self.emit('population evaluated', self.population);
                callback();
            });
        }
        else {
            async.each(self.population, function (candidate, cb) {
                self.fitnessEvaluator(candidate, function (err, score) {
                    candidate.score = score;
                    cb(err);
                });
            }, function (err) {
                if (err) {
                    return callback(err);
                }

                self.emit('population evaluated', self.population);
                callback();
            });
        }
    };

    this.sortPopulation = function (callback) {
        if (self.islandOptions) {
            async.each(self.islands, function (island, cb) {
                setImmediate(function () {
                    island.population = _.sortBy(island.population, function (candidate) {
                        return (self.natural ? -candidate.score : candidate.score);
                    });

                    cb();
                });
            }, function (err) {
                callback();
            });
        }
        else {
            setImmediate(function () {
                self.population = _.sortBy(self.population, function (candidate) {
                    return (self.natural ? -candidate.score : candidate.score);
                });

                callback();
            });
        }
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

        if (self.islandOptions) {
            self.islands.forEach(function (island) {
                island.population.forEach(function (candidate) {
                    self.stats.dataSet.push(candidate.score);
                    self.stats.dataSetSize++;
                    self.stats.total += candidate.score;
                    self.stats.product *= candidate.score;
                    self.stats.reciprocalSum += 1 / candidate.score;
                    self.stats.minimum = Math.min(self.stats.minimum, candidate.score);
                    self.stats.maximum = Math.max(self.stats.maximum, candidate.score);
                });
            });
        }
        else {
            self.population.forEach(function (candidate) {
                self.stats.dataSet.push(candidate.score);
                self.stats.dataSetSize++;
                self.stats.total += candidate.score;
                self.stats.product *= candidate.score;
                self.stats.reciprocalSum += 1 / candidate.score;
                self.stats.minimum = Math.min(self.stats.minimum, candidate.score);
                self.stats.maximum = Math.max(self.stats.maximum, candidate.score);
            });
        }

        if (self.islandOptions) {
            var bestCandidate;
            self.islands.forEach(function (island) {
                if (!bestCandidate) {
                    bestCandidate = island.population[0];
                }
                else {
                    if ((self.natural && island.population[0].score > bestCandidate.score) || (!self.natural && island.population[0].score < bestCandidate.score)) {
                        bestCandidate = island.population[0];
                    }
                }
            });

            self.stats.bestCandidate = bestCandidate;
            self.stats.bestScore = bestCandidate.score;
        }
        else {
            self.stats.bestCandidate = self.population[0];
            self.stats.bestScore = self.population[0].score;
        }

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
        self.stats.time = process.hrtime(self.start)[0];

        self.emit('stats updated', self.stats);
        callback();
    };

    this.evolve = function (callback) {
        if (self.islandOptions) {
            if (self.generation % self.islandOptions.epoch == 0) {
                var lastIsland = self.islands[self.islands.length - 1].population;
                lastIsland = self.shuffle(lastIsland);

                var migrants = lastIsland.slice(0, lastIsland.length * self.islandOptions.migration);

                for (var i=0; i<self.islands.length;i++) {
                    var immigrants = migrants;
                    if (i !== self.islands.length - 1) {
                        self.islands[i].population = self.shuffle(self.islands[i].population);
                        migrants = lastIsland.slice(0, self.islands[i].population.length * self.islandOptions.migration);
                    }

                    for (var j = 0; j < immigrants.length; j++) {
                        self.islands[i].population[self.islands[i].population.length - (self.islands[i].population.length * self.islandOptions.migration) + j] = immigrants[j];
                    }
                }
            }

            async.each(self.islands, function (island, cb) {
                self.evolveEvaluated(island, cb);
            }, function (err) {
                callback(err);
            });
        }
        else {
            self.evolveEvaluated(self, callback);
        }
    };

    this.evolveEvaluated = function (evaluated, callback) {
        var newPopulation = [];
        var elite = [];

        self.eliteCount = self.populationSize * self.elitism;
        for (var i = 0; i < self.eliteCount; i++)
        {
            elite.push(evaluated.population[i]);
        }

        switch (self.selectionStrategy) {
            case Genetical.ROULETTEWHEELSELECTION:
                newPopulation = self.rouletteWheelSelection(evaluated);
                break;
            case Genetical.STOCHASTICUNIVERSALSAMPLING:
                newPopulation = self.stochasticUniversalSampling(evaluated.population);
                break;
            case Genetical.RANK:
                newPopulation = self.rankSelection(evaluated);
                break;
            case Genetical.TOURNAMENT:
                if (!self.selectionStrategyOptions.tournamentSelection || _.isNaN(self.selectionStrategyOptions.tournamentSelection) || self.selectionStrategyOptions.tournamentSelection <= 0.5) {
                    throw "'selectionStrategyOptions.tournamentSelection' must be defined and must be a greater than 0.5"
                }
                newPopulation = self.tournamentSelection(evaluated);
                break;
            case Genetical.SIGMASCALING:
                newPopulation = self.sigmaScaling(evaluated);
                break;
        }

        if (_.indexOf(self.evolutionStrategy, Genetical.CROSSOVER) !== -1) {
            newPopulation = self.crossover(newPopulation);
        }

        if (_.indexOf(self.evolutionStrategy, Genetical.MUTATION) !== -1) {
            newPopulation = self.mutate(newPopulation);
        }

        elite.forEach(function (candidate) {
            newPopulation.push(candidate);
        });

        evaluated.population = newPopulation;
        callback();
    };

    var self = this;
    var adjustScore = function (score) {
        if (self.natural) {
            return score;
        }
        return score == 0 ? Number.POSITIVE_INFINITY : 1/score;
    };

    this.rouletteWheelSelection = function (evaluated) {
        var cumulativeFitnesses = [];
        cumulativeFitnesses.push(adjustScore(evaluated.population[0].score));

        for (var i = 1; i<evaluated.population.length; i++) {
            var score = adjustScore(evaluated.population[i].score);
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
        var selectionSize = self.populationSize - self.eliteCount;
        for (i = 0; i < selectionSize; i++)
        {
            var randomFitness = self.generator.random() * cumulativeFitnesses[cumulativeFitnesses.length - 1];
            var index = binaryIndexOf(cumulativeFitnesses, randomFitness);
            if (index < 0)
            {
                index = Math.abs(index + 1);
            }

            newPopulation.push(evaluated.population[index]);
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

    this.rankSelection = function (evaluated) {
        var rankedPopulation = [];
        var index = -1;
        for (var i = 1; i<evaluated.population.length; i++) {
            var candidate = evaluated.population[i];
            candidate.score = ++index - evaluated.population.length;
            rankedPopulation.push(candidate);
        }
        return self.stochasticUniversalSampling(rankedPopulation, self.populationSize - self.eliteCount);
    };

    this.tournamentSelection = function (evaluated) {
        var newPopulation = [];
        var selectionSize = this.populationSize - this.eliteCount;

        for (var i = 0; i < selectionSize; i++) {
            var index1 = self.getRandomInt(0, evaluated.population.length - 1, this.generator);
            var candidate1 = evaluated.population[index1];
            var index2 = self.getRandomInt(0, evaluated.population.length - 1, this.generator);
            var candidate2 = evaluated.population[index2];

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

    this.sigmaScaling = function (evaluated) {
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

        for (var i = 1; i<evaluated.population.length; i++) {
            var candidate = evaluated.population[i];
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
    };

    this.getRandomInt = function (min, max) {
        return Math.floor(self.generator.random() * (max - min + 1)) + min;
    };

    this.shuffle = function (collection) {
        var index = -1,
            length = collection.length,
            result = Array(length);

        while (++index < length) {
            var rand = self.getRandomInt(0, index);
            if (index != rand) {
                result[index] = result[rand];
            }
            result[rand] = collection[index];
        }
        return result;
    };
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

Genetical.prototype.solve = function () {
    if (!this.populationFactory || !_.isFunction(this.populationFactory)) {
        throw "'populationFactory' must be defined and must be a function"
    }

    if (!this.fitnessEvaluator || !_.isFunction(this.fitnessEvaluator)) {
        throw "'fitnessEvaluator' must be defined and must be a function"
    }

    if (!this.terminationCondition || !_.isFunction(this.terminationCondition)) {
        throw "'terminationCondition' must be defined and must be a function"
    }

    if (_.indexOf([Genetical.ROULETTEWHEELSELECTION, Genetical.STOCHASTICUNIVERSALSAMPLING, Genetical.RANK, Genetical.TOURNAMENT, Genetical.SIGMASCALING], this.selectionStrategy) === -1) {
        throw "'selectionStrategy' must be Genetical.ROULETTEWHEELSELECTION, Genetical.STOCHASTICUNIVERSALSAMPLING, Genetical.RANK, Genetical.TOURNAMENT or Genetical.SIGMASCALING"
    }

    if (this.elitism < 0 || this.elitism >= 1) {
        throw "'elitism' must be non-negative and less than 1";
    }

    if (this.seed && (_.isNaN(this.seed) || !(parseInt(Number(this.seed)) == this.seed && !isNaN(parseInt(this.seed, 10))))) {
        throw "'seed' must be an integer";
    }

    if (this.islandOptions && (_.isNaN(this.islandOptions.epoch) || !(parseInt(Number(this.islandOptions.epoch)) == this.islandOptions.epoch && !isNaN(parseInt(this.islandOptions.epoch, 10))))) {
        throw "You must define the epoch if you use islands";
    }

    if (this.islandOptions && (_.isNaN(this.islandOptions.migration) || !(parseFloat(Number(this.islandOptions.migration)) == this.islandOptions.migration && !isNaN(parseFloat(this.islandOptions.migration))))) {
        throw "You must define the migration rate if you use islands";
    }

    if (this.islandOptions && this.islandOptions.migration && (this.islandOptions.migration < 0 || this.islandOptions.migration >= 1)) {
        throw "'islandOptions.migration' must be non-negative and less than 1";
    }

    if (this.islandOptions && (_.isNaN(this.islandOptions.islands) || !(parseInt(Number(this.islandOptions.islands)) == this.islandOptions.islands && !isNaN(parseInt(this.islandOptions.islands, 10))))) {
        throw "You must define the number of islands if you use islands";
    }

    if (_.isArray(this.evolutionStrategies) && this.evolutionStrategies.length == 0) {
        throw "You must define at least one evolution strategy";
    }

    if (_.isArray(this.evolutionStrategy)) {
        this.evolutionStrategy.forEach(function (strategy) {
           if (strategy !== Genetical.CROSSOVER && strategy !== Genetical.MUTATION) {
                throw "Evolution strategies must be Genetical.CROSSOVER or Genetical.MUTATION";
            }
        });
    }
    else {
        if (this.evolutionStrategy !== Genetical.CROSSOVER || this.evolutionStrategy !== Genetical.MUTATION) {
            throw "Evolution strategies must be Genetical.CROSSOVER or Genetical.MUTATION";
        }
    }

    this.generator = this.seed ? new MersenneTwister(this.seed) : new MersenneTwister();

    this.generation = 0;
    this.population = [];

    var callback = _.isFunction(arguments[0]) ? arguments[0] : arguments[1];
    this.initialPopulation = _.isArray(arguments[0]) && arguments[0].length > 0 ? arguments[0] : null;

    if (!this.initialPopulation && (!this.populationSize || _.isNaN(this.populationSize) || this.populationSize <= 0)) {
        throw "'populationSize' must be defined and must be a greater than 0"
    }

    this.populationSize = this.initialPopulation ? this.initialPopulation.length : this.populationSize;

    var self = this;
    this.start = process.hrtime();
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
                callback(self.stats.bestCandidate, self.generation);
            });
        });
};

module.exports = Genetical;