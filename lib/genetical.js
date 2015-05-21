var async = require('async');
var _ = require('lodash');
var EventEmitter = require('events').EventEmitter;

function Genetical(options) {
    this.populationSize = options.populationSize || 2;
    this.candidateFactory = options.candidateFactory; // TODO Error si no esta definido
    this.terminationCondition = options.terminationCondition; // TODO Error si no esta definido
    this.fitnessEvaluator = options.fitnessEvaluator; // TODO Error si no esta definido
    this.natural = (options.natural !== undefined && options.natural !== null ? options.natural : true);
    this.crossover = options.crossover; // TODO Error si no esta definido
    this.crossoverPoints = options.crossoverPoints || 1;
    this.mutationProbability = options.mutationProbability || 0;
    this.mutate = options.mutate; // TODO Error si mutationProbability > 0 y no esta definido
    this.elitism = options.elitism || 0;
}

Genetical.prototype = new EventEmitter();

Genetical.prototype.evolve = function (callback) {
    var self = this;
    self.generation = 0;
    self.population = [];
    self.solution = null;

    async.series([
        function (cb) {
            self.init(cb);
        },
        function (cb) {
            self.loop(cb);
        }
    ], function (err, results) {
        if (err != null) {
            self.emit('error', {stage: 'evolve', message: err});
            callback(err);
        }
        else {
            callback(self.solution);
        }
    });
};

Genetical.prototype.init = function (callback) {
    var self = this;

    var index = 0;
    async.times(self.populationSize, function (n, next) {
        self.candidateFactory(function (err, candidate) {
            candidate.$index = index++;
            next(err, candidate);
        });
    }, function (err, population) {
        if (err) {
            self.emit('error', {stage: 'init', message: err});
            callback(err);
        }
        else {
            self.population = population;
            self.emit('init', self.population);
            callback();
        }
    });
};

Genetical.prototype.loop = function (callback) {
    var self = this;
    async.until(function () {
            return self.terminationCondition() || false;
        }, function (cb) {
            self.iteration(function () {
                setImmediate(cb);
            });
        }, function (err) {
            if (err != null) {
                self.emit('error', {stage: 'loop', message: err});
                callback(err);
            }
            else {
                callback();
            }
        }
    );
};

Genetical.prototype.iteration = function (callback) {
    var self = this;
    self.generation++;
    async.series([
        function (cb) {
            self.evaluateCandidates(cb);
        }, function (cb) {
            self.parentSelection(cb);
        }, function (cb) {
            self.reproduction(cb);
        }, function (cb) {
            self.childSelection(cb);
        }
    ], function (err, results) {
        if (err != null) {
            self.emit('error', {stage: 'iteration', message: err});
            callback(err);
        }
        else {
            self.emit('evolution', self.generation, self.population, self.solution);
            callback();
        }
    });
};

Genetical.prototype.evaluateCandidates = function (callback) {
    var self = this;
    async.forEach(self.population, function (candidate, cb) {
            self.fitnessEvaluator(candidate, function (err, score) {
                candidate.score = score;
                cb(err);
            })
        }, function (err) {
            if (err) {
                self.emit('error', {stage: 'evaluateCandidates', message: err});
                callback(err);
            }
            else {
                callback();
            }
        }
    )
};

Genetical.prototype.parentSelection = function (callback) {
    var self = this;
    self.parents = [];
    async.forEach(self.population, function (candidate, callback) {
            self.parents.push(candidate);
            callback();
        }, function (err) {
            if (err != null) {
                self.emit('error', {stage: 'parentSelection', message: err});
                callback(err);
            }
            else {
                callback();
            }
        }
    )
};

Genetical.prototype.reproduction = function (callback) {
    var self = this;

    self.children = [];
    async.series([
            function (callback) {
                self.parents = _.sortBy(self.parents, function (candidate) {
                    return (self.natural ? -candidate.score : candidate.score);
                });

                callback();
            }, function (callback) {
                var elitismPopulation = 0;
                if (self.elitism > 0) {
                    elitismPopulation = self.populationSize * self.elitism; //TODO Math.round
                }

                self.children = self.parents.slice(0, elitismPopulation);

                async.until(function () {
                        return (self.parents.length < 2);
                    }, function (cb) {
                        self.crossover(self.parents[0], self.parents[1], self.crossoverPoints, function (children) {
                            children.forEach(function (child) {
                                if (Math.random() < self.mutationProbability) {
                                    self.mutate(child, function (child) {
                                        self.children.push(child);
                                    });
                                }
                                else {
                                    self.children.push(child);
                                }
                            });
                        });

                        self.parents.splice(0, 2);
                        cb();
                    }, function (err) {
                        if (err != null) {
                            self.emit('error', {stage: 'reproduction - crossover', message: err});
                            callback(err);
                        }
                        else {
                            callback();
                        }
                    }
                );
            }, function (callback) {
                self.children = _.sortBy(self.children, function (candidate) {
                    return candidate.score;
                });

                var bestCandidate = self.children[0];
                self.solution = {
                    score: bestCandidate.score,
                    bestCandidate: bestCandidate
                };

                self.children = self.children.slice(0, self.populationSize);

                callback();
            }
        ],
        function (err) {
            if (err != null) {
                self.emit('error', {stage: 'reproduction', message: err});
                callback(err);
            }
            else {
                callback();
            }
        }
    )
};

Genetical.prototype.childSelection = function (callback) {
    var self = this;
    self.population = [];
    async.forEach(self.children, function (item, callback) {
            self.population.push(item);
            callback();
        }, function (err) {
            if (err != null) {
                self.emit('error', {stage: 'childSelection', message: err});
            }
            else {
                callback();
            }
        }
    );
};

module.exports = Genetical;