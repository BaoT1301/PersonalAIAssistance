from dotenv import load_dotenv
from pydantic import BaseModel
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import PydanticOutputParser
from langchain.agents import create_tool_calling_agent, AgentExecutor
from tools import search_tool, wiki_tool, save_tool
import time
import sys

load_dotenv()

class ResearchResponse(BaseModel):
    topic: str
    summary: str
    sources: list[str]
    tools_used: list[str]
    

llm = ChatAnthropic(model="claude-sonnet-4-20250514")
parser = PydanticOutputParser(pydantic_object=ResearchResponse)

prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """
            You are a research assistant that will help generate a research paper.
            Answer the user query and use neccessary tools. 
            Wrap the output in this format and provide no other text\n{format_instructions}
            """,
        ),
        ("placeholder", "{chat_history}"),
        ("human", "{query}"),
        ("placeholder", "{agent_scratchpad}"),
    ]
).partial(format_instructions=parser.get_format_instructions())

tools = [search_tool, wiki_tool, save_tool]
agent = create_tool_calling_agent(
    llm=llm,
    prompt=prompt,
    tools=tools
)

agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True)
print("🔍 AI Research Assistant")
print("=" * 50)

query = input("\nEnter your research topic: ")

print("\n🔄 Researching", end="")
for _ in range(3):
    time.sleep(0.3)
    print(".", end="", flush=True)
print("\n")

response = agent_executor.invoke({"query": query})

print("\n" + "=" * 50)
print("📊 RESULTS")
print("=" * 50 + "\n")

try:
    output = response.get("output")

    if isinstance(output, list) and len(output) > 0:
        output = output[0].get("text", output[0])
    
    if isinstance(output, str):
        output = output.strip()
        if output.startswith("```json"):
            output = output.replace("```json", "").replace("```", "").strip()
    
    structured_response = parser.parse(output)
    
    print(f"📌 TOPIC: {structured_response.topic}\n")
    print(f"📝 SUMMARY:\n{structured_response.summary}\n")
    print(f"🔗 SOURCES:")
    for i, source in enumerate(structured_response.sources, 1):
        print(f"   {i}. {source}")
    print(f"\n🛠️  TOOLS USED: {', '.join(structured_response.tools_used)}")
    
except Exception as e:
    print("⚠️  Failed to parse structured response")
    print(f"Raw output: {response.get('output')}")
    print(f"Error: {e}")