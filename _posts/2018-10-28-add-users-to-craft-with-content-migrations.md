---
layout: post
title: Add users to Craft CMS with content migrations
description: Helpful when you and your team frequently set up Craft sites.
---

I work at a web agency, where we mostly use Craft CMS to build websites. For each website, the same group of people needs access to the control panel. We could manually create their user accounts. Or we could automate it, and play foosball with the time we saved.

Craft CMS content migrations is the perfect tool for the job. We'll use migrations to populate the database with a predefined list of users. I suggest you take a look at the [documentation](https://docs.craftcms.com/v3/content-migrations.html), if you're not already familiar with content migrations.

To create the migration, run the following command in your terminal:

``` bash
./craft migrate/create add_users
```

This will create a new migration file in the `migrations` folder.

``` php
<?php

namespace craft\contentmigrations;

use Craft;
use craft\db\Migration;

/**
 * m181027_161404_add_users migration.
 */
class m181027_161404_add_users extends Migration
{
    /**
     * @inheritdoc
     */
    public function safeUp()
    {
        // Place migration code here...
    }

    /**
     * @inheritdoc
     */
    public function safeDown()
    {
        echo "m181027_161404_add_users cannot be reverted.\n";
        return false;
    }
}
```

I added an array of users to the `safeUp` method, then loop through the array, and create the users.

``` php
public function safeUp()
{
    $users = [
        ['george', 'george@agency.com'],
        ['barry', 'barry@agency.com'],
        ['jean', 'jean@agency.com'],
    ];

    foreach ($users as $userData) {
        [$username, $email] = $userData;

        $this->createUser($username, $email);
    }
}
```

The `createUser` method adds the users to the database.

``` php
use craft\elements\User;

/* ... */

protected function createUser($username, $email)
{
    $user = new User;

    $user->username = $username;
    $user->email = $email;
    $user->admin = true;

    $user->newPassword = CRAFT_ENVIRONMENT === 'local'
        ? $email
        : md5(uniqid().rand());

    $user->passwordResetRequired = CRAFT_ENVIRONMENT !== 'local';

    Craft::$app->getElements()->saveElement($user, false);
}
```

Execute the migration by running `./craft migrate/up`. The users can now login with their email address as password. But only in a local environment. They are forced to set a new password in production or development.
