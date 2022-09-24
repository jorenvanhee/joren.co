---
layout: post
title: Autosave forms with the Vue.js composition API
description: Using debounce and a promise queue.
---

While I still feel the need to press `Cmd/Ctrl - S` every few seconds, a lot of apps have autosave functionality implemented. Here's how to do this in Vue.js. I'll be using the Vue.js [composition API](https://vuejs.org/guide/introduction.html#composition-api).

This is the example we're going to work with today. A form with a title field, text field and a submit button. When submitting the form, the data is posted to a `blog-posts` endpoint. The `api` is fake, but illustrates the use of an HTTP client. It could be replaced by Axios or [Ky](https://github.com/sindresorhus/ky) (my personal favorite). The important thing is that `api.post` returns a promise (it will become clear why later).

```html
<script setup>
import { reactive } from 'vue';
import api from './api';

const form = reactive({
  title: '',
  text: '',
});

const handleSubmit = () => {
  api.post('blog-posts', form);
};
</script>

<template>
  <form @submit.prevent="handleSubmit">
    <input v-model="form.title" />
    <textarea v-model="form.text"></textarea>
    <button>Save</button>
  </form>
</template>
```

The most primitive way of autosaving is saving whenever the form changes. We can do this by listening to the `input` event on the entire `form` (alternatively we could use [watchers](https://vuejs.org/guide/essentials/watchers.html)).

```html
<script setup>
  // ...
  const handleChange = () => {
    api.post('blog-posts', form);
  };
</script>

<template>
  <form @submit.prevent="handleSubmit" @input="handleChange">
    <!-- ... -->
  </form>
</template>
```

As you can imagine, this is not really optimal. With every keystroke the form will be saved, resulting in an unnecessarily high amount of requests. It would be better if the form is saved whenever the user is done typing.

---

This is where `debounce` comes into play. The debounce method takes two arguments. The first one is a delay in milliseconds, the second one is a callback function. Debounce returns a new function that we can use as a better change handler.

```html
<script setup>
import { debounce } from 'throttle-debounce';
// ...

const handleChange = debounce(250, () => {
  api.post('blog-posts', form);
});
</script>
```

When called, our new `handleChange` function will not execute the callback immediately, it will start a timer for 250ms and execute the callback when the timer finishes.

When called a second time with the timer still running, it will reset the timer to 0, forget about the first call and execute the last call when the timer finishes. This means that if we type 4 letters really fast, our form will be saved 250ms after typing the fourth letter.

---

Debounce takes care of restricting the amount of requests, but it doesn't wait for previous requests to finish before starting a new one. This could cause some weird bugs.

Typing 3 words ("one two three"), with a pause after every word, results into 3 requests. Even though the order of the requests is correct, the finishing order is not guaranteed. If the second request finishes after the third request, "one two" would be stored in our database instead of "one two three".

<div class="photo-frame">
  <div class="max-w-[307px]">
    {% image
      "./img/vuejs-autosave/waterfall.png",
      "A sketch of how the result of the code would look.",
      "100vw",
      { widths: [null], formats: ["png"] }
    %}
  </div>
</div>

To make sure a request never starts before another one finishes we can use [p-queue](https://github.com/sindresorhus/p-queue), a promise queue with concurrency control. We will initialize `PQueue` with a concurrency of 1. We can now add functions returning a promise to the queue. P-queue will make sure that there's only one promise running at the same time.

```html
<script setup>
import PQueue from 'p-queue';
// ...

const queue = new PQueue({ concurrency: 1 });

const handleChange = debounce(250, () => {
  queue.clear();
  queue.add(() => api.post('blog-posts', form));
});
</script>
```

The queueing system solves our issue, but we can improve our code by clearing the queue with `queue.clear()` before adding a *task*. There's no point in sending old data to the api when we already have more recent data available.

Consider the following example.

1. A user types "one". A task is being added to the queue and starts executing immediately.
1. The user continues to type, "one two". Another task is added to the queue, but this time it is not executing yet since the first task is not finished.
1. Finally the user completes the sentence, "one two three". The second task (waiting to be executed) is removed by `queue.clear()` and a new task is added to the queue, ready to be executed when the first task finishes.

<div class="photo-frame">
  <div class="max-w-[307px]">
    {% image
      "./img/vuejs-autosave/waterfall-2.png",
      "A sketch of how the result of the code would look.",
      "100vw",
      { widths: [null], formats: ["png"] }
    %}
  </div>
</div>

---

You can play around with the complete example on [StackBlitz](https://stackblitz.com/edit/vitejs-vite-urfaxr?file=src%2FApp.vue).

In the next blog post we're going to refactor everything into a reusable [composable](https://vuejs.org/guide/reusability/composables.html), stay tuned!
