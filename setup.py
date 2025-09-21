from setuptools import setup, find_packages

setup(
    name="ai-terminal",
    version="2.0.0",
    description="An AI-powered terminal interface with natural language processing",
    author="Krishna Sharma",
    author_email="krishnasharma4415@gmail.com",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "flask>=3.1.0",
        "flask-cors>=6.0.0",
        "psutil>=7.1.0",
        "google-generativeai>=0.8.0",
        "python-dotenv>=1.1.0",
        "gunicorn>=23.0.0",
    ],
    classifiers=[
        "Development Status :: 4 - Beta",
        "Environment :: Web Environment",
        "Framework :: Flask",
        "Intended Audience :: Developers",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.9",
        "Topic :: Terminals",
        "Topic :: Utilities",
    ],
    python_requires=">=3.9",
)
