# PDnetwork
URL: https://ornl.github.io/PDnetwork/

## A tool for analyzing collaborations in the field of peridynamics
This tool allows users to visualize and analyze the evolution of the peridynamics co-authorship network. Each node represents a scientist, and links connect scientists who have co-authored publications. [Click here to learn how to use PDnetwork.](papervisinfo.pdf)

## Citing PDnetwork
If you use PDnetwork in your work, please cite the [Zenodo release](https://doi.org/10.5281/zenodo.23425602).

## Publications
B. Dahal, P. Seleson, and J. Trageser, The evolution of the peridynamics co-authorship network, *Journal of Peridynamics and Nonlocal Modeling* 5 (2023): 311-355. https://doi.org/10.1007/s42102-022-00082-5 ([Springer, view-only version](https://rdcu.be/cRvai)).

B. Dahal and P. Seleson, The evolution of the peridynamics community in its first quarter century, *Journal of Peridynamics and Nonlocal Modeling* 8 (2026): 11. https://doi.org/10.1007/s42102-026-00146-w ([Springer, view-only version](https://rdcu.be/9vsquNaYQ4sa)).

## Data
Data from Scopus, Copyright Elsevier (2026). The data has been obfuscated for posting on GitHub (src/publications.json and src/nodeinfo.json) and is decoded in the browser. 

The data can be generated from a Scopus export with the columns `af`, `si`, `ti`, and `py` by running 

```npm run build-data -- path/to/data.csv```

followed by

```npm run build-nodeinfo -- --force``` 

to compute the node layout for the new data (requires Python with packages, run `python -m pip install -r scripts/requirements.txt` to install the dependencies).

## Building
To build the website, install Node.js and npm, and first install the dependencies by running

```npm install```.

Then, to build the static files from source, run

```npm run build```.

This will create the website in the `dist/` folder.

## License
PDnetwork is distributed under a [BSD 3-Clause license](LICENSE).
