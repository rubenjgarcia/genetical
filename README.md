# genetical
An implementation of Genetics Algorithms for Node JS

## Install

You can install using Node Package Manager (npm):

    npm install genetical

## Usage

First you need to create a new Genetical object

```javascript
var Genetical = require('genetical');

var options = {
    populationSize: 100,
    populationFactory: populationFactory,
    terminationCondition: terminationCondition,
    fitnessEvaluator: fitnessEvaluator,
    natural: false,
    selectionStrategy: Genetical.ROULETTEWHEELSELECTION,
    evolutionOptions: {
        crossover: crossover,
        crossoverPoints: 1,
        mutate: mutate,
        mutationProbability : 0.02
    },
    islandOptions: {
            islands: 2,
            migration: 0.1,
            epoch: 10
    },
    elitism: 0.05,
    seed: 2
};

var ga = new Genetical(options);
````

You must define several options:

* populationSize: (required if you don't provide an initial population in solve method or if you use islands) This is the initial population that will be created
* populationFactory: (required if you don't provide an initial population in solve method or if you use islands) A function to create the population: `function populationFactory(populationLength, populationSize, randomGenerator, callback)`
  * populationLength: Actual population 
  * populationSize: Population size passed in options
  * randomGenerator: Random generator for generate numbers. For more information see https://github.com/cslarsen/mersenne-twister
  * callback: Callback function to pass created population. First argument is `errors` and second argument is `candidate`. You can pass a single candidate or an array of candidates
* terminationCondition: (required) A function who is called in every iteration before evolve the population. Must return a boolean to indicate if the algorithm must stop or must continue. It receives as a parameter an object `stats` that has the next information:
  * dataSet: The scores dataset
  * dataSetSize: The dataset size
  * total: Total sum of scores
  * product: Total product of scores
  * reciprocalSum: Total reciprocal sum of scores ( 1 / score)
  * minimum: Minimun score
  * maximum: Maximun score
  * bestCandidate: Best candidate
  * bestScore: Best score
  * mean: Arithmetic mean
  * standardDeviaton: Standard deviation of the scores
  * generation: Actual generation
  * time: Seconds since start
* fitnessEvaluator: (required) A function to evaluate the candidates: `function fitnessEvaluator(candidate, callback)`
  * candidate: The candidate to evaluate
  * callback: Callback function to pass evaluated score. First argument is `errors` and second argument is the candidate`score`
* natural: (optional, default: `true`) If `true` the candidates with higher scores are better. If `false` the candidates with lower scores are better
* evolutionStrategy: (optional, default: `[Genetical.CROSSOVER, Genetical.MUTATION]`) Evolution strategy or strategies to use. You can choose between `Genetical.CROSSOVER` or `Genetical.MUTATION`
* selectionStrategy: (optional, default: `Genetical.ROULETTEWHEELSELECTION`) You can choose between `Genetical.ROULETTEWHEELSELECTION`, `Genetical.STOCHASTICUNIVERSALSAMPLING`, `Genetical.RANK`, `Genetical.TOURNAMENT` or `Genetical.SIGMASCALING`
  *  ROULETTEWHEELSELECTION: More info here http://en.wikipedia.org/wiki/Fitness_proportionate_selection
  *  STOCHASTICUNIVERSALSAMPLING: More info here http://en.wikipedia.org/wiki/Stochastic_universal_sampling
  *  RANK: More info here http://en.wikipedia.org/wiki/Reward-based_selection
  *  TOURNAMENT: More info here http://en.wikipedia.org/wiki/Tournament_selection If you choose this strategy you must define selectionStrategyOptions.tournamentSelection with a value higher than 0.5. That is the posibility that the fitter candidate will be chosen
  *  SIGMASCALING: I've couldn't find any article in wikipedia, sorry
* evolutionOptions.crossover: (required if choose `Genetical.CROSSOVER` as evolutionStrategy) A function to do the crossover: `function crossover(parent1, parent2, points, randomGenerator, callback)`
  * parent1: The first parent
  * parent2: The second parent
  * points: Crossover points
  * randomGenerator: Random generator for generate numbers. For more information see https://github.com/cslarsen/mersenne-twister
  * callback: Callback function to pass children. It takes as an argument a child or a children array
* evolutionOptions.crossoverPoints: (optional, default: 1) Crossover points to use in the crossover function
* evolutionOptions.mutate: (required if choose `Genetical.MUTATION` as evolutionStrategy) A function to do the gen candidate mutation: `function mutate(candidate, mutationProbability, randomGenerator, callback)`
  * candidate: The candidate to mutate
  * mutationProbability: The mutation probability
  * randomGenerator: Random generator for generate numbers. For more information see https://github.com/cslarsen/mersenne-twister
  * callback: Callback function to pass the candidate
* evolutionOptions.mutationProbability: (required) The mutation probability
* elitism: (optional, default: 0) Percentage of population with the best scores that will remain unchanged in the next generation . More info here http://en.wikipedia.org/wiki/Genetic_algorithm#Elitism
* islandOptions: (optional) You can evolve 'islands'. Every island has a population and this population migrates to another island to mix with its population
  * islands: (required) Number of islands to evolve
  * migration: (required) Percentage of population that migrate to another island
  * epoch: (required) Number of generations before a migration occurs
* seed: If you want a repeatable random sequence provide a seed

To solve the algorithm use the solve function
```javascript
ga.solve(initialPopulation, function (bestCandidate, generation) {
    console.log('Best Candidate', bestCandidate, 'Generation', generation);
});
````

You can pass an initial population before callback if you're not using islands

## Events
You can subscribe to these events:
* initial population created: It pass the initial population as argument once is generated
* population evaluated: It pass the population every time is evaluated by the fitness evaluator
* stats updated: It pass the stats every time the stats are updated, after evaluate the initital population and after every time the population is evaluated once is evolved
* error: It pass the error when an error is thrown

```javascript
ga.on('stats updated', function (stats) {
    console.log('stats updated', stats);
});
````

## Examples

You can see an example in `test/stringTest.js`. The goal is to evolve a population of randomly-generated strings until at least one matches a specified target string. You can pass a string as an argument, if not the string will be `HELLO WORLD`

Another example is in `test/combinationExample.js`. The goal is minimizing the value of function f (x) = ((a + 2b + 3c + 4d) - 30)