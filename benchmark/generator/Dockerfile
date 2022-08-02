# FROM ros:noetic-ros-core
FROM arm64v8/ros:noetic-ros-core

SHELL ["/bin/bash", "-c"]

RUN apt-get update \
    && apt-get install -y \
    gnupg python3-pip python3-tf2-ros ros-noetic-foxglove-msgs \
    && rm -rf /var/lib/apt/lists/*
RUN pip3 install gnupg pycryptodome
RUN pip3 install --index-url https://rospypi.github.io/simple rosbag
RUN pip3 install matplotlib notebook pandas mcap-ros1-support

RUN mkdir /notebooks

WORKDIR /notebooks
EXPOSE 8888/tcp

CMD ["jupyter", "notebook", "--port=8888", "--no-browser", "--ip=0.0.0.0", "--allow-root"]
