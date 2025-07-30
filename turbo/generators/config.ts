import { PlopTypes } from '@turbo/gen';

export default function generator(plop: PlopTypes.NodePlopAPI): void {
  // Package generator
  plop.setGenerator('package', {
    description: 'Create a new package',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'Package name (without @nostrpass/ prefix):',
      },
      {
        type: 'input',
        name: 'description',
        message: 'Package description:',
      },
    ],
    actions: [
      {
        type: 'add',
        path: 'packages/{{name}}/package.json',
        templateFile: 'templates/package/package.json.hbs',
      },
      {
        type: 'add',
        path: 'packages/{{name}}/tsconfig.json',
        templateFile: 'templates/package/tsconfig.json.hbs',
      },
      {
        type: 'add',
        path: 'packages/{{name}}/src/index.ts',
        templateFile: 'templates/package/index.ts.hbs',
      },
      {
        type: 'add',
        path: 'packages/{{name}}/README.md',
        templateFile: 'templates/package/README.md.hbs',
      },
    ],
  });

  // App generator
  plop.setGenerator('app', {
    description: 'Create a new app',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'App name:',
      },
      {
        type: 'list',
        name: 'framework',
        message: 'Framework:',
        choices: ['next', 'vite', 'express'],
      },
    ],
    actions: function(data) {
      const actions = [];
      
      if (data?.framework === 'next') {
        actions.push({
          type: 'add',
          path: 'apps/{{name}}/package.json',
          templateFile: 'templates/app-next/package.json.hbs',
        });
        actions.push({
          type: 'add',
          path: 'apps/{{name}}/tsconfig.json',
          templateFile: 'templates/app-next/tsconfig.json.hbs',
        });
        actions.push({
          type: 'add',
          path: 'apps/{{name}}/next.config.js',
          templateFile: 'templates/app-next/next.config.js.hbs',
        });
        actions.push({
          type: 'add',
          path: 'apps/{{name}}/src/app/page.tsx',
          templateFile: 'templates/app-next/page.tsx.hbs',
        });
      }
      
      if (data?.framework === 'vite') {
        actions.push({
          type: 'add',
          path: 'apps/{{name}}/package.json',
          templateFile: 'templates/app-vite/package.json.hbs',
        });
        actions.push({
          type: 'add',
          path: 'apps/{{name}}/tsconfig.json',
          templateFile: 'templates/app-vite/tsconfig.json.hbs',
        });
        actions.push({
          type: 'add',
          path: 'apps/{{name}}/tsconfig.node.json',
          templateFile: 'templates/app-vite/tsconfig.node.json.hbs',
        });
        actions.push({
          type: 'add',
          path: 'apps/{{name}}/vite.config.ts',
          templateFile: 'templates/app-vite/vite.config.ts.hbs',
        });
        actions.push({
          type: 'add',
          path: 'apps/{{name}}/index.html',
          templateFile: 'templates/app-vite/index.html.hbs',
        });
        actions.push({
          type: 'add',
          path: 'apps/{{name}}/.gitignore',
          templateFile: 'templates/app-vite/.gitignore.hbs',
        });
        actions.push({
          type: 'add',
          path: 'apps/{{name}}/src/main.tsx',
          templateFile: 'templates/app-vite/src/main.tsx.hbs',
        });
        actions.push({
          type: 'add',
          path: 'apps/{{name}}/src/App.tsx',
          templateFile: 'templates/app-vite/src/App.tsx.hbs',
        });
        actions.push({
          type: 'add',
          path: 'apps/{{name}}/src/App.css',
          templateFile: 'templates/app-vite/src/App.css.hbs',
        });
        actions.push({
          type: 'add',
          path: 'apps/{{name}}/src/index.css',
          templateFile: 'templates/app-vite/src/index.css.hbs',
        });
        actions.push({
          type: 'add',
          path: 'apps/{{name}}/src/vite-env.d.ts',
          templateFile: 'templates/app-vite/src/vite-env.d.ts.hbs',
        });
        actions.push({
          type: 'add',
          path: 'apps/{{name}}/src/env.ts',
          templateFile: 'templates/app-vite/src/env.ts.hbs',
        });
      }
      
      return actions;
    },
  });
}