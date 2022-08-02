# Foxglove Studio Benchmark Generation

The benchmark generator creates synthetic MCAP files to stress test Studio's performance.

## Instructions

1. Docker and a POSIX-compliant environment containing `bash` are required (Linux, MacOS)
2. Run `./run.sh` to start a container for the Jupyter Notebook bound to port 8888
3. Open a browser and navigate to http://localhost:8888/
4. Open the `generator.ipynb` notebook
5. Execute the notebook to create a `benchmark.mcap` file in this directory
