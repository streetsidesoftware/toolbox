jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: |
          pnpm install
          pnpm test
