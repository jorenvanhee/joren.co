---
layout: post
title: Create, update or delete hasMany relationships in Laravel
description: A macro similar to the existing updateOrCreate method.
---

A pattern that I often encounter when developing forms is a form containing a `hasMany` relationship. For example, a recipe form with the ability to add ingredients.

Laravel makes it easy to validate a form like this, thanks to [nested array validation](https://laravel.com/docs/9.x/validation#validating-nested-array-input). A little less obvious is creating, updating and deleting the related models (in this case ingredients).

In this article I'm going to explain you how to make a macro that allows you to call `createUpdateOrDelete()` on Eloquent `hasMany` relationships.

``` php
$recipe
  ->ingredients()
  ->createUpdateOrDelete($data);
```

Feel free to [skip to the macro](#macro) immediately.

---

Before dealing with the macro, let's think about how we would handle this problem.

The first form submission of our recipe form is straightforward. All the ingredients are new, so we could just create them.

``` php
$recipe->ingredients()->createMany([
  ['name' => 'Pecorino cheese'],
  ['name' => 'Spaghetti'],
  ['name' => 'Pancetta'],
  ['name' => 'Cream'],
]);
```

But that wouldn't work for the subsequent form submissions, these can lead to different scenarios. Ingredients could be changed, missing or completely new.

``` yaml
# First request
recipe:
  title: Spaghetti carbonara
  ingredients:
    - name: Pecorino cheese
    - name: Spaghetti
    - name: Pancetta
    - name: Cream # Missing in second request

# Second request
recipe:
  title: Spaghetti carbonara
  ingredients:
    - id: 1
      name: Pecorino cheese
    - id: 2
      name: Spaghetti
    - id: 3
      name: Guanciale      # Changed
    - name: Salt & pepper  # New
    - name: Eggs           # New
```

As you can see in the hypothetical request data, the second request contains the id's of the existing ingredients. With this information we can determine what ingredients should be created, updated or deleted.

Ingredients with an id should be updated and the ones without an id created. For these two cases we can use Laravel's `updateOrCreate` or `upsert` methods. I'll be using [upsert](https://laravel.com/docs/9.x/eloquent#upserts) since this method can handle multiple records in one go (a single SQL query).

⚠️  If you want the `updated_at` timestamps to be updated correctly, or you rely on [Eloquent events](https://laravel.com/docs/9.x/eloquent#events), then you should use `updateOrCreate` instead of `upsert`. This will require you to loop over all incoming ingredients and pass them into the `updateOrCreate` method.

Before looking at the macro, let's look at how an upsert works.

``` php
$recipe->ingredients()->upsert([
  ['id' => 1, 'recipe_id' => 1, 'name' => 'Pecorino cheese'],
  ['id' => 2, 'recipe_id' => 1, 'name' => 'Spaghetti'],
  ['id' => 3, 'recipe_id' => 1, 'name' => 'Guanciale'],
  ['id' => null, 'recipe_id' => 1, 'name' => 'Salt & pepper'],
  ['id' => null, 'recipe_id' => 1, 'name' => 'Eggs'],
], ['id']);
```

The first argument contains all the ingredient values (note that we have to manually include the foreign key `recipe_id`). The second argument lists the column(s) that uniquely identify the records (in this case we use the `id`).

ℹ️  We could add a third argument to provide an array with the columns that should be updated when a matching record is found. In our case they can all be updated, so we can omit this argument.

For the deleting of the missing ingredients, we can use `whereNotIn` combined with `delete`. The delete has to happen before the upsert, otherwise the newly added records will be delete as well.

``` php
// Delete
$recipe
  ->ingredients()
  ->whereNotIn('id', [1, 2, 3])
  ->delete();

// Upsert
// ...
```

Let's now combine everything we've learned into one macro.

---
<div id="macro"></div>

Let's define a macro in the `AppServiceProvider` `boot()` method. The name of the macro will be `createUpdateOrDelete` and it will accept `iterable $records`. An iterable could be an array, or even a Laravel collection.

``` php
// AppServiceProvider.php
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Support\Macros\CreateUpdateOrDelete;

// Inside of the boot() method.
HasMany::macro('createUpdateOrDelete', function (iterable $records) {
  /** @var HasMany */
  $hasMany = $this;

  return (new CreateUpdateOrDelete($hasMany, $records))();
});
```

Laravel automatically binds `$this` to the `HasMany` instance. We'll use that together with the records to create an instance of our macro class. We can call the `CreateUpdateOrDelete` instance like a function, since we're going to make it invokable.

In the `CreateUpdateOrDelete` class we wrap the delete and upsert methods in a transaction. Either everything fails, or everything succeeds. And as mentioned before, we execute the delete before the upsert.

``` php
namespace App\Support\Macros;

use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;

class CreateUpdateOrDelete
{
  protected $query;

  protected $records;

  public function __construct(HasMany $query, iterable $records)
  {
    $this->query = $query;
    $this->records = collect($records);
  }

  public function __invoke()
  {
    DB::transaction(function () {
      $this->deleteMissingRecords();
      $this->upsertRecords();
    });
  }
}
```

The implementation of `deleteMissingRecords` is fairly similar to what we've seen before, but there are a couple of differences. Instead of hardcoding the `id` we grab the key name from the related table (ingredients). Once we have the key name, we can pluck the id's and filter out any empty values.

``` php
protected function deleteMissingRecords()
{
  // id (ingredient table)
  $recordKeyName = $this->query->getRelated()->getKeyName();

  $existingRecordIds = $this->records
    ->pluck($recordKeyName)
    ->filter();

  (clone $this->query)
    ->whereNotIn($recordKeyName, $existingRecordIds)
    ->delete();
}
```

The delete is then executed on a clone of the query. The clone is necessary because otherwise the `whereNotIn` clause would still be present on the query when we use it for the upsert.

In `upsertRecords` we map over the records and add the foreign key. We also make sure that `id` is always present, even for new records (`null`). This is needed for `upsert` to work correctly.

``` php
protected function upsertRecords()
{
  $values = $this->records->map(function ($record) {
    // Set $record['recipe_id'] to parent key.
    $record[
      $this->query->getForeignKeyName()
    ] = $this->query->getParentKey();

    // Set $record['id'] to null when missing.
    $recordKeyName = $this->query->getRelated()->getKeyName();
    $record[$recordKeyName] = array_key_exists($recordKeyName, $record)
      ? $record[$recordKeyName]
      : null;

    return $record;
  })->toArray();

  (clone $this->query)->upsert(
    $values,
    [$this->query->getRelated()->getKeyName()],
  );
}
```

---

Some people might prefer `updateOrCreate` over `upsert`, others might be using UUIDs. Nevertheless, you now have all the knowledge you need to use this macro, or a variation that fits your situation best.
